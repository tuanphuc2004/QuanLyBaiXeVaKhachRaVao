from __future__ import annotations

import os
from pathlib import Path


def get_media_dir() -> Path:
    # Server media directory (used for storing captured plate images).
    # You can override it by setting PLATE_MEDIA_DIR.
    return Path(os.getenv("PLATE_MEDIA_DIR", "/var/www/visitor-api/media"))


def to_media_path(relative_path: str) -> Path:
    relative = (relative_path or "").lstrip("/").replace("\\", "/")
    return get_media_dir() / relative


def safe_unlink(file_path: Path) -> None:
    try:
        if file_path.exists():
            file_path.unlink()
    except Exception:
        # Ignore delete errors to avoid breaking API flow.
        pass

