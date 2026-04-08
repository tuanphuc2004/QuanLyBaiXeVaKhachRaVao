import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from logging_config import logger, log_requests_middleware
from routers.auth import router as auth_router
from routers.visitors import router as visitors_router
from routers.visits import router as visits_router
from routers.plate_recognitions import router as plate_recognitions_router
from media_store import get_media_dir


def _cors_allow() -> tuple[list[str], bool]:
    """
    Không dùng allow_origins=['*'] kèm allow_credentials=True (vi phạm CORS).
    Mặc định: * + credentials=False — phù hợp dev và Bearer token (axios mặc định không gửi cookie).
    CORS_ORIGINS: danh sách URL cách nhau bởi dấu phẩy để bật allow_credentials=True.
    """
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if not raw or raw == "*":
        return (["*"], False)
    origins = [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]
    return (origins if origins else ["*"], True)


_allow_origins, _allow_credentials = _cors_allow()

app = FastAPI(title="Visitor & Vehicle Access Control (Python Mock API)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(log_requests_middleware)

app.include_router(auth_router, prefix="/api")
app.include_router(visitors_router, prefix="/api")
app.include_router(visits_router, prefix="/api")
app.include_router(plate_recognitions_router, prefix="/api")

# Serve stored plate/visit images during local dev (production uses Nginx alias).
media_dir = str(get_media_dir())
os.makedirs(media_dir, exist_ok=True)
app.mount("/media", StaticFiles(directory=media_dir), name="media")


@app.get("/")
def root():
    logger.info("Root endpoint called")
    return {"message": "Python mock API for Visitor & Vehicle Access Control"}

