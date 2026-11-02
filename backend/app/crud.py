import re
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app import models, schemas


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    return f"+91{digits}" if len(digits) == 10 else f"+{digits}"


def update_customer(
    db: Session, name: str, phone: str, location: str | None = None,
    service: str | None = None, *, order: bool = False, marketing_opt_in: bool = False,
):
    phone = normalize_phone(phone)
    customer = db.query(models.Customer).filter_by(phone=phone).first()
    if customer is None:
        customer = models.Customer(name=name, phone=phone, total_orders=0, total_complaints=0)
        db.add(customer)
    customer.name = name
    customer.location = location or customer.location
    customer.requested_service = service or customer.requested_service
    customer.updated_at = datetime.utcnow()
    if not order:
        customer.marketing_opt_in = marketing_opt_in
    if order:
        customer.total_orders += 1
    else:
        customer.total_complaints += 1
    return customer


def get_batteries(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.BatteryProduct).order_by(models.BatteryProduct.id).offset(skip).limit(limit).all()


def get_battery_stock(db: Session, battery_id: int):
    return db.query(models.BatteryProduct).filter(models.BatteryProduct.id == battery_id).first()


def create_order(db: Session, order: schemas.OrderCreate):
    battery = get_battery_stock(db, order.battery_id)
    if battery is None:
        raise ValueError("Battery product was not found")
    if battery.stock_quantity < order.quantity:
        raise ValueError("Insufficient battery stock")

    total_amount = (Decimal(battery.price) * order.quantity).quantize(Decimal("0.01"))
    db_order = models.CustomerOrder(
        **order.model_dump(),
        total_amount=total_amount,
    )
    battery.stock_quantity -= order.quantity
    db.add(db_order)
    update_customer(db, order.customer_name, order.phone_number, service="Battery purchase", order=True)
    db.commit()
    db.refresh(db_order)
    return db_order


def log_message(
    db: Session,
    message: schemas.MessageCreate,
    sent_status: str = "not_configured",
):
    db_message = models.AutomatedMessageLog(
        **message.model_dump(),
        sent_status=sent_status,
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

# --- Bookings ---
def create_booking(db: Session, booking: schemas.BookingCreate):
    db_booking = models.ServiceBooking(**booking.model_dump())
    update_customer(db, booking.name, booking.phone, booking.location, booking.selected_service, marketing_opt_in=booking.marketing_opt_in)
    db.add(db_booking)
    db.commit()
    db.refresh(db_booking)
    return db_booking


def get_customers(db: Session, skip: int = 0, limit: int = 500):
    return db.query(models.Customer).order_by(models.Customer.updated_at.desc()).offset(skip).limit(limit).all()


def sync_customer_profiles(db: Session):
    bookings = db.query(models.ServiceBooking).order_by(models.ServiceBooking.created_at).all()
    orders = db.query(models.CustomerOrder).order_by(models.CustomerOrder.created_at).all()
    profiles = {}
    for booking in bookings:
        phone = normalize_phone(booking.phone)
        profile = profiles.setdefault(phone, {"name": booking.name, "location": booking.location, "service": booking.selected_service, "created_at": booking.created_at, "complaints": 0, "orders": 0, "marketing_opt_in": False})
        profile.update(name=booking.name, location=booking.location, service=booking.selected_service)
        profile["marketing_opt_in"] = booking.marketing_opt_in
        profile["complaints"] += 1
    for order in orders:
        phone = normalize_phone(order.phone_number)
        profile = profiles.setdefault(phone, {"name": order.customer_name, "location": None, "service": "Battery purchase", "created_at": order.created_at, "complaints": 0, "orders": 0, "marketing_opt_in": False})
        profile.update(name=order.customer_name)
        if order.created_at and (profile["created_at"] is None or order.created_at < profile["created_at"]):
            profile["created_at"] = order.created_at
        profile["orders"] += 1
    for phone, profile in profiles.items():
        customer = db.query(models.Customer).filter_by(phone=phone).first()
        if customer is None:
            customer = models.Customer(phone=phone, name=profile["name"])
            db.add(customer)
        customer.name = profile["name"]
        customer.location = profile["location"]
        customer.requested_service = profile["service"]
        customer.created_at = profile["created_at"] or datetime.utcnow()
        customer.total_complaints = profile["complaints"]
        customer.total_orders = profile["orders"]
        customer.marketing_opt_in = bool(customer.marketing_opt_in) or profile["marketing_opt_in"]
    db.commit()


def get_bookings(db: Session, skip: int = 0, limit: int = 100):
    return (
        db.query(models.ServiceBooking)
        .order_by(models.ServiceBooking.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def update_booking_status(db: Session, booking_id: int, status: str):
    booking = db.query(models.ServiceBooking).filter(models.ServiceBooking.id == booking_id).first()
    if booking is None:
        return None
    booking.status = status
    db.commit()
    db.refresh(booking)
    return booking


# --- Reviews ---
def create_review(db: Session, review: schemas.ReviewCreate):
    db_review = models.Review(**review.model_dump())
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    return db_review

def get_reviews(db: Session, skip: int = 0, limit: int = 100, verified_only: bool = True):
    query = db.query(models.Review)
    if verified_only:
        query = query.filter_by(is_verified=True)
    return query.order_by(models.Review.created_at.desc()).offset(skip).limit(limit).all()


def verify_review(db: Session, review_id: int, is_verified: bool):
    review = db.query(models.Review).filter_by(id=review_id).first()
    if review is None:
        return None
    review.is_verified = is_verified
    db.commit()
    db.refresh(review)
    return review