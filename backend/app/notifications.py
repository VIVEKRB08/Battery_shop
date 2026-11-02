import json
import os
from datetime import datetime
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.database import SessionLocal
from app.models import Customer, OfferBroadcast, OfferDelivery


def whatsapp_configured() -> bool:
    return all(os.getenv(name) for name in (
        "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_TEMPLATE_NAME",
    ))


def send_offer_broadcast(broadcast_id: int):
    db = SessionLocal()
    try:
        broadcast = db.get(OfferBroadcast, broadcast_id)
        if broadcast is None:
            return
        broadcast.status = "SENDING"
        db.commit()
        version = os.getenv("WHATSAPP_API_VERSION", "v22.0")
        endpoint = f"https://graph.facebook.com/{version}/{os.environ['WHATSAPP_PHONE_NUMBER_ID']}/messages"
        review_url = os.getenv("PUBLIC_REVIEW_URL", "http://localhost:5173/review")
        offset = 0
        while deliveries := db.query(OfferDelivery).filter_by(broadcast_id=broadcast_id).order_by(OfferDelivery.id).offset(offset).limit(100).all():
            for delivery in deliveries:
                customer = db.get(Customer, delivery.customer_id)
                body = {
                    "messaging_product": "whatsapp",
                    "to": customer.phone.lstrip("+"),
                    "type": "template",
                    "template": {
                        "name": os.environ["WHATSAPP_TEMPLATE_NAME"],
                        "language": {"code": os.getenv("WHATSAPP_TEMPLATE_LANGUAGE", "en")},
                        "components": [{"type": "body", "parameters": [{"type": "text", "text": f"{broadcast.message}\nReviews: {review_url}"}]}],
                    },
                }
                request = Request(
                    endpoint,
                    data=json.dumps(body).encode(),
                    headers={"Authorization": "Bearer " + os.getenv("WHATSAPP_ACCESS_TOKEN", ""), "Content-Type": "application/json"},
                    method="POST",
                )
                try:
                    with urlopen(request, timeout=20) as response:
                        if response.status >= 300:
                            raise RuntimeError(f"WhatsApp API returned HTTP {response.status}")
                    delivery.status, delivery.sent_at = "SENT", datetime.utcnow()
                    delivery.error = None
                except (HTTPError, URLError, TimeoutError, RuntimeError) as error:
                    detail = error.read().decode(errors="replace") if isinstance(error, HTTPError) else str(error)
                    delivery.status, delivery.error = "FAILED", detail[:500]
                db.commit()
            offset += len(deliveries)
        sent = db.query(OfferDelivery).filter_by(broadcast_id=broadcast_id, status="SENT").count()
        failed = db.query(OfferDelivery).filter_by(broadcast_id=broadcast_id, status="FAILED").count()
        broadcast.status = "SENT" if not failed else "FAILED" if not sent else "PARTIAL"
        db.commit()
    finally:
        db.close()
