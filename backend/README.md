# Devi Batteries API

Configure the first admin login and session signing key in the backend environment. Never commit these values:

```powershell
$env:ADMIN_PHONE = '+91 8870020370'
$env:ADMIN_INITIAL_PASSWORD = 'Devibattery@123'
$env:ADMIN_SESSION_SECRET = 'generate-a-long-random-secret'
$env:ADMIN_COOKIE_SECURE = 'true'
# For a frontend on a different site, also set SameSite=None (requires Secure).
# $env:ADMIN_COOKIE_SAMESITE = 'none'
uvicorn app.main:app
```

The initial credential is seeded once from `ADMIN_PHONE` and `ADMIN_INITIAL_PASSWORD` when both are configured; the backend intentionally does not ship with a default admin password. Password changes are retained in the database. `/admin` uses an HTTP-only session cookie and the forgot-password flow writes a short-lived, attempt-limited OTP to backend logs for development delivery. Connect a trusted SMS/WhatsApp delivery provider before using password recovery in production. `ADMIN_COOKIE_SECURE=true` requires HTTPS. `ADMIN_COOKIE_SAMESITE` defaults to `lax`; use `none` plus secure cookies for cross-site frontend/API deployments, and configure that frontend origin in `CORS_ORIGINS`. `ADMIN_SESSION_SECRET` must be shared by all API workers; tokens are invalidated on password reset.

The older `ADMIN_API_KEY` / `X-Admin-Key` authorization remains available for existing integrations. Do not put any admin secret in frontend source, `VITE_*` variables, or a committed `.env` file. Service requests, customer profiles, and reviews are stored in the configured SQL database (`DATABASE_URL`, SQLite by default). Customer marketing opt-in is explicit; broadcasts only target opted-in profiles. Services are seeded from defaults into the `services` table on first startup; admin CRUD endpoints manage them and the public `GET /api/services` returns active services only. The authenticated `POST /api/admin/service-images` accepts JPEG/PNG/WebP uploads up to 5 MB; uploads are served from `/api/uploads/`.

The authenticated `GET /api/admin/analytics` endpoint returns registered-customer and complaint counts plus the average submitted review rating for the admin dashboard.

Promotional broadcasts use Meta's WhatsApp Cloud API and an approved template with one body text parameter. Configure `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_TEMPLATE_NAME`; optionally set `WHATSAPP_API_VERSION`, `WHATSAPP_TEMPLATE_LANGUAGE`, and the customer-accessible `PUBLIC_REVIEW_URL`. Broadcast jobs run through FastAPI `BackgroundTasks`; delivery status is persisted for the admin dashboard. Keep credentials private and use a durable worker for high-volume campaigns.

Set frontend `VITE_API_URL` to the API origin when it is not `http://localhost:8000`. Start the API from this directory with `uvicorn app.main:app`.
