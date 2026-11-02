from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class BatteryProduct(Base):
    __tablename__ = "battery_products"

    id = Column(Integer, primary_key=True, index=True)
    brand = Column(String(100), nullable=False, index=True)
    model_number = Column(String(100), nullable=False, unique=True, index=True)
    capacity_ah = Column(Numeric(10, 2), nullable=False)
    price = Column(Numeric(12, 2), nullable=False)
    stock_quantity = Column(Integer, nullable=False, default=0)


class CustomerOrder(Base):
    __tablename__ = "customer_orders"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String(150), nullable=False)
    phone_number = Column(String(30), nullable=False, index=True)
    battery_id = Column(Integer, ForeignKey("battery_products.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    status = Column(String(30), nullable=False, default="Pending")
    total_amount = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class AutomatedMessageLog(Base):
    __tablename__ = "automated_message_logs"

    id = Column(Integer, primary_key=True, index=True)
    customer_phone = Column(String(30), nullable=False, index=True)
    message_text = Column(Text, nullable=False)
    sent_status = Column(String(40), nullable=False, default="not_configured")
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)


class ServiceBooking(Base):
    __tablename__ = "service_bookings"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    location = Column(String, nullable=False)
    selected_service = Column(String, nullable=False)
    complaint = Column(Text, nullable=True)
    geo_link = Column(String, nullable=True)
    marketing_opt_in = Column(Boolean, nullable=False, default=False)
    status = Column(String(20), nullable=False, default="OPEN")
    created_at = Column(DateTime, default=datetime.utcnow)


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    phone = Column(String(30), nullable=False, unique=True, index=True)
    location = Column(String(500), nullable=True)
    requested_service = Column(String(200), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    total_orders = Column(Integer, nullable=False, default=0)
    total_complaints = Column(Integer, nullable=False, default=0)
    marketing_opt_in = Column(Boolean, nullable=False, default=False)


class OfferBroadcast(Base):
    __tablename__ = "offer_broadcasts"

    id = Column(Integer, primary_key=True, index=True)
    message = Column(String(1000), nullable=False)
    status = Column(String(20), nullable=False, default="QUEUED")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class OfferDelivery(Base):
    __tablename__ = "offer_deliveries"

    id = Column(Integer, primary_key=True, index=True)
    broadcast_id = Column(Integer, ForeignKey("offer_broadcasts.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="QUEUED")
    error = Column(String(500), nullable=True)
    sent_at = Column(DateTime, nullable=True)


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=True)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=False)
    is_verified = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AdminCredential(Base):
    __tablename__ = "admin_credentials"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(30), nullable=False, unique=True, index=True)
    password_hash = Column(String(512), nullable=False)
    token_version = Column(Integer, nullable=False, default=1)
    failed_attempts = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    updated_at = Column(DateTime, nullable=False, default=utc_now)


class AdminOtpChallenge(Base):
    __tablename__ = "admin_otp_challenges"

    phone = Column(String(30), primary_key=True)
    otp_digest = Column(String(128), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=utc_now)


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    title_ta = Column(String(200), nullable=True)
    description = Column(Text, nullable=False)
    description_ta = Column(Text, nullable=True)
    image = Column(String(1000), nullable=False)
    icon = Column(String(40), nullable=False, default="🔋")
    is_active = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    updated_at = Column(DateTime, nullable=False, default=utc_now)


class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String(100), primary_key=True)
    value = Column(String(500), nullable=False)
