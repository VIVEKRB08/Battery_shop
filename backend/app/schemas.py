from decimal import Decimal
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class BatteryProductCreate(BaseModel):
    brand: str = Field(min_length=1, max_length=100)
    model_number: str = Field(min_length=1, max_length=100)
    capacity_ah: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    stock_quantity: int = Field(ge=0)

    model_config = ConfigDict(protected_namespaces=())


class BatteryProductResponse(BatteryProductCreate):
    id: int

    model_config = ConfigDict(from_attributes=True)


class OrderCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=150)
    phone_number: str = Field(min_length=7, max_length=30)
    battery_id: int = Field(gt=0)
    quantity: int = Field(default=1, ge=1)


class OrderResponse(BaseModel):
    id: int
    customer_name: str
    phone_number: str
    battery_id: int
    quantity: int
    status: str
    total_amount: Decimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MessageCreate(BaseModel):
    customer_phone: str = Field(min_length=7, max_length=30)
    message_text: str = Field(min_length=1, max_length=5000)


class MessageLogResponse(BaseModel):
    id: int
    customer_phone: str
    message_text: str
    sent_status: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Booking Schemas ---
class BookingCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    phone: str = Field(min_length=7, max_length=30)
    location: str = Field(min_length=1, max_length=500)
    selected_service: str = Field(min_length=1, max_length=200)
    complaint: Optional[str] = Field(default=None, max_length=2000)
    geo_link: Optional[str] = Field(default=None, max_length=1000)
    marketing_opt_in: bool = False


class BookingStatusUpdate(BaseModel):
    status: Literal["OPEN", "RESOLVED"]


class BookingResponse(BookingCreate):
    id: int
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CustomerResponse(BaseModel):
    id: int
    name: str
    phone: str
    location: Optional[str]
    requested_service: Optional[str]
    created_at: datetime
    updated_at: datetime
    total_orders: int
    total_complaints: int
    marketing_opt_in: bool

    model_config = ConfigDict(from_attributes=True)


class OfferCreate(BaseModel):
    message: str = Field(min_length=1, max_length=900)
    customer_ids: Optional[list[int]] = None


class OfferBroadcastResponse(BaseModel):
    id: int
    message: str
    status: str
    created_at: datetime
    total_recipients: int
    sent: int
    failed: int


class AdminAnalyticsResponse(BaseModel):
    total_customers: int
    pending_complaints: int
    resolved_complaints: int
    average_review_rating: float


class AdminLoginRequest(BaseModel):
    phone: str = Field(min_length=7, max_length=30)
    password: str = Field(min_length=1, max_length=256)


class AdminLoginResponse(BaseModel):
    authenticated: bool = True
    phone: Optional[str] = None


class AdminForgotPasswordRequest(BaseModel):
    phone: str = Field(min_length=7, max_length=30)


class AdminForgotPasswordResponse(BaseModel):
    detail: str


class AdminVerifyOtpRequest(BaseModel):
    phone: str = Field(min_length=7, max_length=30)
    otp: str = Field(pattern=r"^\d{6}$")
    new_password: str = Field(min_length=12, max_length=256)


class AdminDailyAnalyticsResponse(BaseModel):
    selected_date: date
    total_complaints: int
    pending_complaints: int
    resolved_complaints: int
    yesterday_pending_complaints: int


class ServiceCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    title_ta: Optional[str] = Field(default=None, max_length=200)
    description: str = Field(min_length=1, max_length=4000)
    description_ta: Optional[str] = Field(default=None, max_length=4000)
    image: str = Field(min_length=1, max_length=1000)
    icon: str = Field(default="🔋", max_length=40)
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0)

    @field_validator("image")
    @classmethod
    def validate_image_url(cls, value: str) -> str:
        if (
            value.startswith("/images/")
            or value.startswith("/api/uploads/")
            or value.startswith("https://")
            or value.startswith("http://")
        ):
            return value
        raise ValueError("Image must be an /images/ or /api/uploads/ path, or an HTTP(S) URL")


class ServiceUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    title_ta: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, min_length=1, max_length=4000)
    description_ta: Optional[str] = Field(default=None, max_length=4000)
    image: Optional[str] = Field(default=None, min_length=1, max_length=1000)
    icon: Optional[str] = Field(default=None, max_length=40)
    is_active: Optional[bool] = None
    sort_order: Optional[int] = Field(default=None, ge=0)

    @field_validator("image")
    @classmethod
    def validate_image_url(cls, value: Optional[str]) -> Optional[str]:
        if (
            value is None
            or value.startswith("/images/")
            or value.startswith("/api/uploads/")
            or value.startswith("https://")
            or value.startswith("http://")
        ):
            return value
        raise ValueError("Image must be an /images/ or /api/uploads/ path, or an HTTP(S) URL")

    @model_validator(mode="after")
    def reject_null_required_fields(self):
        for field in ("title", "description", "image", "icon", "is_active", "sort_order"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class ServiceResponse(ServiceCreate):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReviewVerificationUpdate(BaseModel):
    is_verified: bool


# --- Review Schemas ---
class ReviewCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    location: Optional[str] = Field(default="Customer", max_length=150)
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=1, max_length=2000)

class ReviewResponse(ReviewCreate):
    id: int
    is_verified: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)