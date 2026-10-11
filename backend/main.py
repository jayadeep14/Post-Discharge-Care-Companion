import asyncio
import logging
from contextlib import asynccontextmanager
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routes.calle import router as calle_router
from backend.routes.medications import router as medications_router
from backend.routes.patient_chat import router as patient_chat_router
from backend.routes.readmissions import router as readmissions_router
from backend.services.scheduler_service import process_automated_calls
from backend.services.realtime_listener import start_realtime_listener
from backend.whatsapp_bot import router as whatsapp_router
from backend.config import APP_ENV, CORS_ALLOWED_ORIGINS, ENABLE_HSTS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logging.getLogger("scheduler").setLevel(logging.INFO)
logging.getLogger("realtime_listener").setLevel(logging.INFO)
# These libraries log every periodic scheduler tick and every Supabase poll.
# Keep those routine transport/heartbeat messages out of the application log.
logging.getLogger("apscheduler").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)

scheduler = AsyncIOScheduler(timezone=ZoneInfo("Asia/Kolkata"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(
        process_automated_calls,
        trigger="interval",
        minutes=1,
        id="automated_patient_followups",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    scheduler.start()
    listener_task = asyncio.create_task(start_realtime_listener())
    # Pick up schedules already due when the backend starts, without waiting a minute.
    await process_automated_calls()
    try:
        yield
    finally:
        listener_task.cancel()
        try:
            await listener_task
        except asyncio.CancelledError:
            pass
        scheduler.shutdown(wait=False)


production = APP_ENV == "production"
app = FastAPI(
    title="CALL-E Post-Discharge Orchestrator",
    lifespan=lifespan,
    docs_url=None if production else "/docs",
    redoc_url=None if production else "/redoc",
    openapi_url=None if production else "/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cache-Control"] = "no-store"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    if ENABLE_HSTS:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response
app.include_router(calle_router)
app.include_router(whatsapp_router)
app.include_router(medications_router)
app.include_router(patient_chat_router)
app.include_router(readmissions_router)


@app.get("/")
def health_check():
    return {"status": "ok"}
