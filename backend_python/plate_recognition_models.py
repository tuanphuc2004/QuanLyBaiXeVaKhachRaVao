from __future__ import annotations

import json
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import List, Optional

from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel


class PlateRecognitionStatus(str, Enum):
    pending = "pending"
    confirmed = "confirmed"
    rejected = "rejected"


def normalize_vehicle_type(value: Optional[str]) -> str:
    v = (value or "").strip().lower()
    if not v:
        return "Xe máy"

    # Keep it consistent with values used in frontend <select>.
    if "may" in v or "xe máy" in v or "xemay" in v:
        return "Xe máy"
    if "tai" in v or "xe tải" in v or "xetai" in v:
        return "Xe tải"
    if "oto" in v or "ô tô" in v or "xe oto" in v or "xe ô tô" in v or "xoto" in v:
        return "Ô tô"
    # Fallback.
    return "Xe máy"


def infer_vehicle_type_from_plate(plate_number: str) -> tuple[str, float]:
    """
    Very simple heuristic fallback for MVP.
    If you integrate real OCR/classifier later, replace this.
    """
    p = (plate_number or "").strip().upper()
    if not p:
        return ("Xe máy", 0.0)

    # Typical formats in Vietnam vary, so this heuristic is intentionally basic.
    # - shorter strings -> motorbike
    # - longer strings -> car/truck
    if len(p) <= 9:
        return ("Xe máy", 0.45)
    if len(p) <= 11:
        return ("Ô tô", 0.40)
    return ("Xe tải", 0.35)


class PlateRecognitionCandidate(BaseModel):
    candidateId: int
    plateNumber: str
    vehicleType: str
    confidence: Optional[float] = None
    createdAt: datetime
    status: PlateRecognitionStatus = PlateRecognitionStatus.pending
    decidedAt: Optional[datetime] = None
    plateImageRelativePath: Optional[str] = None


_DATA_FILE = Path(__file__).with_name("plate_recognitions_data.json")


def _load_candidates() -> List[PlateRecognitionCandidate]:
    if not _DATA_FILE.exists():
        return []
    try:
        with _DATA_FILE.open("r", encoding="utf-8") as f:
            raw = json.load(f)
        return [PlateRecognitionCandidate(**item) for item in raw]
    except Exception:
        return []


def _save_candidates(candidates: List[PlateRecognitionCandidate]) -> None:
    _DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with _DATA_FILE.open("w", encoding="utf-8") as f:
        json.dump(
            jsonable_encoder(candidates),
            f,
            ensure_ascii=False,
            indent=2,
        )


PLATE_RECOGNITIONS: List[PlateRecognitionCandidate] = _load_candidates()


def save_plate_recognitions(candidates: List[PlateRecognitionCandidate]) -> None:
    _save_candidates(candidates)


