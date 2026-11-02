import logging
import os
import re
import secrets
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import List

from fastapi import BackgroundTasks, Cookie, Depends, FastAPI, File, Header, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import func, inspect, text
from sqlalchemy.orm import Session

from app.admin_auth import (
    create_session_token,
    hash_otp,
    hash_password,
    normalize_admin_phone,
    verify_otp,
    verify_password,
    verify_session_token,
)
from app.database import engine, Base, get_db, SessionLocal
from app import schemas, crud
from app import models  # noqa: F401
from app.notifications import send_offer_broadcast, whatsapp_configured

logger = logging.getLogger(__name__)
ADMIN_SESSION_LIFETIME = 8 * 60 * 60
ADMIN_SESSION_COOKIE = "devi_admin_session"
ADMIN_COOKIE_SECURE = os.getenv("ADMIN_COOKIE_SECURE", "").lower() == "true"
ADMIN_COOKIE_SAMESITE = os.getenv("ADMIN_COOKIE_SAMESITE", "lax").lower()
if ADMIN_COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    raise RuntimeError("ADMIN_COOKIE_SAMESITE must be 'lax', 'strict', or 'none'")
if ADMIN_COOKIE_SAMESITE == "none" and not ADMIN_COOKIE_SECURE:
    raise RuntimeError("ADMIN_COOKIE_SAMESITE=none requires ADMIN_COOKIE_SECURE=true")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


DEFAULT_SERVICES = (
    {
        "title": "Inverter & UPS Sales and Service",
        "title_ta": "இன்வெர்ட்டர் மற்றும் யுபிஎஸ் விற்பனை & சேவை",
        "description": "Expert installation, backup optimization, and repair services for home and commercial inverters.",
        "description_ta": "வீடு மற்றும் வணிக இன்வெர்ட்டர்களுக்கான சிறந்த நிறுவல் மற்றும் பழுதுபார்க்கும் சேவை.",
        "image": "/images/inverter-ups.jpg",
        "icon": "⚡",
        "sort_order": 0,
    },
    {
        "title": "Car Battery Replacement",
        "title_ta": "கார் பேட்டரி மாற்றம்",
        "description": "Fast diagnostics and genuine battery replacement for cars and SUVs.",
        "description_ta": "அனைத்து வகை கார்களுக்கும் உடனடி பேட்டரி மாற்றம்.",
        "image": "/images/car-battery.jpg",
        "icon": "🚗",
        "sort_order": 1,
    },
    {
        "title": "Bike & Scooter Battery Replacement",
        "title_ta": "பைக் மற்றும் ஸ்கூட்டர் பேட்டரி மாற்றம்",
        "description": "Battery testing and installation for two-wheelers and scooters.",
        "description_ta": "பைக் மற்றும் ஸ்கூட்டர்களுக்கு பேட்டரி பரிசோதனை மற்றும் மாற்றம்.",
        "image": "/images/bike-battery.jpg",
        "icon": "🛵",
        "sort_order": 2,
    },
    {
        "title": "Jump Start & Breakdown Support",
        "title_ta": "ஜம்ப் ஸ்டார்ட் & பிரேக் டவுன் உதவி",
        "description": "On-site emergency jump-start and roadside troubleshooting.",
        "description_ta": "சாலையில் பேட்டரி பழுதானால் உடனடி ஜம்ப் ஸ்டார்ட் சேவை.",
        "image": "/images/jump-start.jpg",
        "icon": "🔌",
        "sort_order": 3,
    },
    {
        "title": "Old Battery Buyback (Scrap Discount)",
        "title_ta": "பழைய பேட்டரி எக்ஸ்சேஞ்ச் (ஸ்க்ராப் தள்ளுபடி)",
        "description": "Exchange your old battery for value toward your new purchase.",
        "description_ta": "பழைய பேட்டரியை கொடுத்து புதிய பேட்டரியில் தள்ளுபடி பெறுங்கள்.",
        "image": "/images/powerzone_battery.jpg",
        "icon": "♻️",
        "sort_order": 4,
    },
)
SERVICE_UPLOAD_DIR = Path(
    os.getenv(
        "SERVICE_UPLOAD_DIR",
        str(Path(__file__).resolve().parent.parent / "uploads"),
    )
)
MAX_SERVICE_IMAGE_BYTES = 5 * 1024 * 1024
SERVICE_IMAGE_TYPES = {
    "image/jpeg": ("jpg", lambda data: data.startswith(b"\xff\xd8\xff")),
    "image/png": ("png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/webp": ("webp", lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP"),
}


def seed_services(db: Session):
    marker = db.get(models.AppSetting, "default_services_seeded")
    if marker is not None:
        return
    if db.query(models.Service.id).first() is None:
        db.add_all(models.Service(**service) for service in DEFAULT_SERVICES)
    db.add(models.AppSetting(key="default_services_seeded", value="true"))
    db.commit()


def seed_admin_credential(db: Session):
    phone = os.getenv("ADMIN_PHONE", "").strip()
    password = os.getenv("ADMIN_INITIAL_PASSWORD", "")
    if not phone and not password:
        return
    if not phone or not password:
        raise RuntimeError("Set both ADMIN_PHONE and ADMIN_INITIAL_PASSWORD to seed admin login")
    if len(password) < 12:
        raise RuntimeError("ADMIN_INITIAL_PASSWORD must be at least 12 characters")
    normalized_phone = normalize_admin_phone(phone)
    credential = db.query(models.AdminCredential).filter_by(phone=normalized_phone).first()
    if credential is None:
        db.add(models.AdminCredential(phone=normalized_phone, password_hash=hash_password(password)))
        db.commit()


def set_admin_session_cookie(response: Response, token: str):
    response.set_cookie(
        key=ADMIN_SESSION_COOKIE,
        value=token,
        max_age=ADMIN_SESSION_LIFETIME,
        httponly=True,
        secure=ADMIN_COOKIE_SECURE,
        samesite=ADMIN_COOKIE_SAMESITE,
        path="/api",
    )


def migrate_admin_credentials_schema():
    required_columns = {
        "failed_attempts": "INTEGER NOT NULL DEFAULT 0",
        "locked_until": "DATETIME",
        "token_version": "INTEGER NOT NULL DEFAULT 1",
    }
    with engine.begin() as connection:
        inspector = inspect(connection)
        if not inspector.has_table("admin_credentials"):
            raise RuntimeError("admin_credentials table was not created")
        existing_columns = {column["name"] for column in inspector.get_columns("admin_credentials")}
        for column_name, column_definition in required_columns.items():
            if column_name not in existing_columns:
                connection.execute(
                    text(
                        f"ALTER TABLE admin_credentials ADD COLUMN "
                        f"{column_name} {column_definition}"
                    )
                )
        connection.execute(
            text(
                "UPDATE admin_credentials SET failed_attempts = 0 "
                "WHERE failed_attempts IS NULL"
            )
        )
        connection.execute(
            text(
                "UPDATE admin_credentials SET token_version = 1 "
                "WHERE token_version IS NULL"
            )
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    migrate_admin_credentials_schema()
    if "marketing_opt_in" not in {column["name"] for column in inspect(engine).get_columns("service_bookings")}:
        with engine.begin() as connection:
            connection.execute(text(
                "ALTER TABLE service_bookings ADD COLUMN marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE"
            ))
    if "is_verified" not in {column["name"] for column in inspect(engine).get_columns("reviews")}:
        with engine.begin() as connection:
            connection.execute(text(
                "ALTER TABLE reviews ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT FALSE"
            ))
    with engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE service_bookings "
                "SET status = CASE WHEN upper(status) = 'RESOLVED' THEN 'RESOLVED' ELSE 'OPEN' END "
                "WHERE status IS NULL OR status != upper(status) "
                "OR upper(status) NOT IN ('OPEN', 'RESOLVED')"
            )
        )
    db = SessionLocal()
    try:
        if db.query(models.Customer.id).first() is None:
            crud.sync_customer_profiles(db)
        seed_services(db)
        seed_admin_credential(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Devi Batteries API", version="1.0.0", lifespan=lifespan)

allowed_origins = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
}
allowed_origins.update(
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_admin(
    x_admin_key: str = Header(default="", alias="X-Admin-Key"),
    authorization: str = Header(default=""),
    session_cookie: str = Cookie(default="", alias=ADMIN_SESSION_COOKIE),
    db: Session = Depends(get_db),
):
    token = session_cookie
    if authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if token:
        payload = verify_session_token(token)
        if payload:
            credential = db.query(models.AdminCredential).filter_by(phone=payload["phone"]).first()
            if credential and credential.token_version == payload["version"]:
                return credential
    admin_key = os.getenv("ADMIN_API_KEY")
    if admin_key and x_admin_key and secrets.compare_digest(x_admin_key, admin_key):
        return None
    raise HTTPException(status_code=401, detail="Admin authentication required")


@app.post("/api/admin/login", response_model=schemas.AdminLoginResponse)
def admin_login(
    login: schemas.AdminLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    try:
        phone = normalize_admin_phone(login.phone)
    except ValueError:
        phone = ""
    credential = db.query(models.AdminCredential).filter_by(phone=phone).first() if phone else None
    now = _utc_now()
    if credential and credential.locked_until and credential.locked_until > now:
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")
    if not credential or not verify_password(login.password, credential.password_hash):
        if credential:
            credential.failed_attempts += 1
            if credential.failed_attempts >= 5:
                credential.failed_attempts = 0
                credential.locked_until = now + timedelta(minutes=15)
            db.commit()
        raise HTTPException(status_code=401, detail="Invalid phone number or password")
    credential.failed_attempts = 0
    credential.locked_until = None
    db.commit()
    token = create_session_token(phone, credential.token_version, ADMIN_SESSION_LIFETIME)
    set_admin_session_cookie(response, token)
    return {"authenticated": True, "phone": credential.phone}


@app.post("/api/admin/logout", status_code=204)
def admin_logout(response: Response):
    response.delete_cookie(key=ADMIN_SESSION_COOKIE, path="/api")


@app.get("/api/admin/session", response_model=schemas.AdminLoginResponse)
def admin_session(
    response: Response,
    session_cookie: str = Cookie(default="", alias=ADMIN_SESSION_COOKIE),
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
):
    token = session_cookie
    if authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    payload = verify_session_token(token) if token else None
    credential = (
        db.query(models.AdminCredential).filter_by(phone=payload["phone"]).first()
        if payload
        else None
    )
    if credential and credential.token_version == payload["version"]:
        return {"authenticated": True, "phone": credential.phone}
    if session_cookie:
        response.delete_cookie(key=ADMIN_SESSION_COOKIE, path="/api")
    return {"authenticated": False, "phone": None}


@app.post(
    "/api/admin/forgot-password",
    response_model=schemas.AdminForgotPasswordResponse,
)
def admin_forgot_password(
    request: schemas.AdminForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    try:
        phone = normalize_admin_phone(request.phone)
    except ValueError:
        phone = ""
    credential = db.query(models.AdminCredential).filter_by(phone=phone).first() if phone else None
    if credential:
        challenge = db.query(models.AdminOtpChallenge).filter_by(phone=phone).first()
        now = _utc_now()
        if challenge and challenge.created_at > now - timedelta(seconds=60):
            return {
                "detail": "If the admin phone is registered, a password-reset OTP has been issued. Check the backend log in development."
            }
        otp = f"{secrets.randbelow(1_000_000):06d}"
        values = {
            "otp_digest": hash_otp(phone, otp),
            "expires_at": now + timedelta(minutes=10),
            "attempts": 0,
        }
        if challenge:
            for field, value in values.items():
                setattr(challenge, field, value)
            challenge.created_at = now
        else:
            db.add(models.AdminOtpChallenge(phone=phone, **values))
        db.commit()
        logger.warning("Development admin password-reset OTP for phone ending %s: %s", phone[-4:], otp)
    return {
        "detail": "If the admin phone is registered, a password-reset OTP has been issued. Check the backend log in development."
    }


@app.post(
    "/api/admin/verify-otp",
    response_model=schemas.AdminForgotPasswordResponse,
)
def admin_verify_otp(
    request: schemas.AdminVerifyOtpRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    try:
        phone = normalize_admin_phone(request.phone)
    except ValueError:
        phone = ""
    challenge = db.query(models.AdminOtpChallenge).filter_by(phone=phone).first() if phone else None
    credential = db.query(models.AdminCredential).filter_by(phone=phone).first() if phone else None
    if not challenge or not credential or challenge.expires_at < _utc_now():
        if challenge:
            db.delete(challenge)
            db.commit()
        raise HTTPException(status_code=400, detail="OTP is invalid or expired")
    if challenge.attempts >= 5:
        db.delete(challenge)
        db.commit()
        raise HTTPException(status_code=400, detail="OTP is invalid or expired")
    if not verify_otp(phone, request.otp, challenge.otp_digest):
        challenge.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="OTP is invalid or expired")
    credential.password_hash = hash_password(request.new_password)
    credential.token_version += 1
    credential.failed_attempts = 0
    credential.locked_until = None
    credential.updated_at = _utc_now()
    db.delete(challenge)
    db.commit()
    token = create_session_token(phone, credential.token_version, ADMIN_SESSION_LIFETIME)
    set_admin_session_cookie(response, token)
    return {"detail": "Password reset successfully"}


@app.get("/")
def root():
    return {"message": "Welcome to Devi Batteries API"}


@app.get("/api/healthcheck")
def healthcheck(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc
    return {"status": "ok", "database": "connected"}


@app.get("/api/batteries", response_model=List[schemas.BatteryProductResponse])
def fetch_batteries(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    if skip < 0 or limit < 1 or limit > 500:
        raise HTTPException(status_code=422, detail="skip must be >= 0 and limit must be 1-500")
    return crud.get_batteries(db=db, skip=skip, limit=limit)


@app.post("/api/orders", response_model=schemas.OrderResponse, status_code=201)
def create_order(order: schemas.OrderCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_order(db=db, order=order)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/send-message", response_model=schemas.MessageLogResponse, status_code=202)
def send_message(message: schemas.MessageCreate, db: Session = Depends(get_db)):
    return crud.log_message(db=db, message=message)


# --- BOOKINGS ENDPOINTS ---
@app.post("/api/bookings", response_model=schemas.BookingResponse)
def create_new_booking(booking: schemas.BookingCreate, db: Session = Depends(get_db)):
    return crud.create_booking(db=db, booking=booking)

@app.get("/api/bookings", response_model=List[schemas.BookingResponse])
def fetch_all_bookings(
    skip: int = 0,
    limit: int = 100,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if skip < 0 or limit < 1 or limit > 500:
        raise HTTPException(status_code=422, detail="skip must be >= 0 and limit must be 1-500")
    return crud.get_bookings(db=db, skip=skip, limit=limit)


@app.patch("/api/bookings/{booking_id}/status", response_model=schemas.BookingResponse)
def update_booking_status(
    booking_id: int,
    update: schemas.BookingStatusUpdate,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    booking = crud.update_booking_status(db, booking_id, update.status)
    if booking is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return booking


@app.get("/api/customers", response_model=List[schemas.CustomerResponse])
def fetch_customers(
    skip: int = 0,
    limit: int = 500,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if skip < 0 or limit < 1 or limit > 500:
        raise HTTPException(status_code=422, detail="skip must be >= 0 and limit must be 1-500")
    return crud.get_customers(db, skip, limit)


@app.get("/api/admin/analytics", response_model=schemas.AdminAnalyticsResponse)
def fetch_admin_analytics(
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return {
        "total_customers": db.query(func.count(models.Customer.id)).scalar() or 0,
        "pending_complaints": db.query(func.count(models.ServiceBooking.id))
        .filter(models.ServiceBooking.status == "OPEN")
        .scalar() or 0,
        "resolved_complaints": db.query(func.count(models.ServiceBooking.id))
        .filter(models.ServiceBooking.status == "RESOLVED")
        .scalar() or 0,
        "average_review_rating": float(
            db.query(func.avg(models.Review.rating)).scalar() or 0
        ),
    }


@app.get("/api/admin/analytics/daily", response_model=schemas.AdminDailyAnalyticsResponse)
def fetch_daily_analytics(
    selected_date: date,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    day_start = datetime.combine(selected_date, time.min)
    day_end = day_start + timedelta(days=1)
    yesterday_start = day_start - timedelta(days=1)
    yesterday_pending = (
        db.query(func.count(models.ServiceBooking.id))
        .filter(
            models.ServiceBooking.created_at >= yesterday_start,
            models.ServiceBooking.created_at < day_start,
            models.ServiceBooking.status == "OPEN",
        )
        .scalar()
        or 0
    )
    on_selected_day = db.query(models.ServiceBooking).filter(
        models.ServiceBooking.created_at >= day_start,
        models.ServiceBooking.created_at < day_end,
    )
    return {
        "selected_date": selected_date,
        "total_complaints": on_selected_day.count(),
        "pending_complaints": on_selected_day.filter(models.ServiceBooking.status == "OPEN").count(),
        "resolved_complaints": on_selected_day.filter(models.ServiceBooking.status == "RESOLVED").count(),
        "yesterday_pending_complaints": yesterday_pending,
    }


@app.get("/api/services", response_model=List[schemas.ServiceResponse])
def fetch_active_services(db: Session = Depends(get_db)):
    return (
        db.query(models.Service)
        .filter_by(is_active=True)
        .order_by(models.Service.sort_order, models.Service.id)
        .all()
    )


@app.post("/api/admin/service-images", status_code=201)
async def upload_service_image(
    file: UploadFile = File(...),
    _: None = Depends(require_admin),
):
    image_type = SERVICE_IMAGE_TYPES.get(file.content_type or "")
    if image_type is None:
        raise HTTPException(status_code=415, detail="Upload a JPEG, PNG, or WebP image")
    content = await file.read(MAX_SERVICE_IMAGE_BYTES + 1)
    if len(content) > MAX_SERVICE_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 5 MB or smaller")
    extension, verify_signature = image_type
    if not verify_signature(content):
        raise HTTPException(status_code=415, detail="The uploaded file is not a valid image of the selected type")
    filename = f"{uuid.uuid4().hex}.{extension}"
    try:
        SERVICE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        (SERVICE_UPLOAD_DIR / filename).write_bytes(content)
    except OSError as exc:
        logger.exception("Unable to save uploaded service image")
        raise HTTPException(status_code=500, detail="Unable to save the service image") from exc
    return {"image": f"/api/uploads/{filename}"}


@app.get("/api/uploads/{filename}", include_in_schema=False)
def fetch_service_image(filename: str):
    if not re.fullmatch(r"[0-9a-f]{32}\.(jpg|png|webp)", filename):
        raise HTTPException(status_code=404, detail="Image not found")
    image_path = SERVICE_UPLOAD_DIR / filename
    if not image_path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(image_path)


@app.get("/api/admin/services", response_model=List[schemas.ServiceResponse])
def fetch_admin_services(
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return db.query(models.Service).order_by(models.Service.sort_order, models.Service.id).all()


@app.post("/api/admin/services", response_model=schemas.ServiceResponse, status_code=201)
def create_service(
    service: schemas.ServiceCreate,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    db_service = models.Service(**service.model_dump())
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    return db_service


@app.patch("/api/admin/services/{service_id}", response_model=schemas.ServiceResponse)
def update_service(
    service_id: int,
    update: schemas.ServiceUpdate,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    db_service = db.get(models.Service, service_id)
    if db_service is None:
        raise HTTPException(status_code=404, detail="Service not found")
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(db_service, field, value)
    db_service.updated_at = _utc_now()
    db.commit()
    db.refresh(db_service)
    return db_service


@app.delete("/api/admin/services/{service_id}", status_code=204)
def delete_service(
    service_id: int,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    db_service = db.get(models.Service, service_id)
    if db_service is None:
        raise HTTPException(status_code=404, detail="Service not found")
    db.delete(db_service)
    db.commit()


def offer_status(db: Session, broadcast: models.OfferBroadcast):
    deliveries = db.query(models.OfferDelivery).filter_by(broadcast_id=broadcast.id).all()
    return {
        "id": broadcast.id,
        "message": broadcast.message,
        "status": broadcast.status,
        "created_at": broadcast.created_at,
        "total_recipients": len(deliveries),
        "sent": sum(item.status == "SENT" for item in deliveries),
        "failed": sum(item.status == "FAILED" for item in deliveries),
    }


@app.post("/api/offers", response_model=schemas.OfferBroadcastResponse, status_code=202)
def create_offer(
    offer: schemas.OfferCreate,
    background_tasks: BackgroundTasks,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if not whatsapp_configured():
        raise HTTPException(status_code=503, detail="Configure WhatsApp Cloud API credentials and an approved template")
    if not offer.message.strip():
        raise HTTPException(status_code=422, detail="Offer message cannot be blank")
    customers = db.query(models.Customer).filter_by(marketing_opt_in=True)
    if offer.customer_ids is not None:
        ids = set(offer.customer_ids)
        customers = customers.filter(models.Customer.id.in_(ids))
    recipients = customers.order_by(models.Customer.id).all()
    if not recipients:
        raise HTTPException(status_code=422, detail="No opted-in customers selected")
    broadcast = models.OfferBroadcast(message=offer.message, status="QUEUED")
    db.add(broadcast)
    db.flush()
    db.add_all(models.OfferDelivery(broadcast_id=broadcast.id, customer_id=customer.id) for customer in recipients)
    db.commit()
    db.refresh(broadcast)
    result = offer_status(db, broadcast)
    background_tasks.add_task(send_offer_broadcast, broadcast.id)
    return result


@app.get("/api/offers/{broadcast_id}", response_model=schemas.OfferBroadcastResponse)
def fetch_offer(
    broadcast_id: int,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    broadcast = db.get(models.OfferBroadcast, broadcast_id)
    if broadcast is None:
        raise HTTPException(status_code=404, detail="Offer broadcast not found")
    return offer_status(db, broadcast)


# --- REVIEWS ENDPOINTS ---
@app.post("/api/reviews", response_model=schemas.ReviewResponse)
def submit_review(review: schemas.ReviewCreate, db: Session = Depends(get_db)):
    return crud.create_review(db=db, review=review)

@app.get("/api/reviews", response_model=List[schemas.ReviewResponse])
def fetch_all_reviews(db: Session = Depends(get_db)):
    return crud.get_reviews(db=db)


@app.get("/api/admin/reviews", response_model=List[schemas.ReviewResponse])
def fetch_admin_reviews(
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return crud.get_reviews(db=db, verified_only=False)


@app.patch("/api/reviews/{review_id}/verification", response_model=schemas.ReviewResponse)
def update_review_verification(
    review_id: int,
    update: schemas.ReviewVerificationUpdate,
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    review = crud.verify_review(db, review_id, update.is_verified)
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found")
    return review