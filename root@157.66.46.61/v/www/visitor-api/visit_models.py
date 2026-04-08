from datetime import datetime
from typing import List, Optional
import json
from pathlib import Path

from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel


class Visit(BaseModel):
    visitId: int
    qrOrIdNumber: str
    vehiclePlate: str
    vehicleType: str
    badgeNumber: str
    checkInTime: datetime
    checkOutTime: Optional[datetime] = None
    # Used by ParkingOps flow: store the image captured when recognition is confirmed.
    vehiclePlateImageRelativePath: Optional[str] = None


class CheckinRequest(BaseModel):
    qrOrIdNumber: str
    vehiclePlate: str = ""
    vehicleType: str = ""
    badgeNumber: str = ""


class CheckoutRequest(BaseModel):
    qrOrBadge: str


_DATA_FILE = Path(__file__).with_name("visits_data.json")


def _load_visits() -> List["Visit"]:
    if not _DATA_FILE.exists():
        return []
    try:
        with _DATA_FILE.open("r", encoding="utf-8") as f:
            raw = json.load(f)
        return [Visit(**item) for item in raw]
    except Exception:
        return []


def save_visits(visits: List["Visit"]) -> None:
    _DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with _DATA_FILE.open("w", encoding="utf-8") as f:
        json.dump(
            jsonable_encoder(visits),
            f,
            ensure_ascii=False,
            indent=2,
        )


VISITS: List[Visit] = _load_visits()

