from typing import List, Optional
import json
from pathlib import Path
from uuid import uuid4

from pydantic import BaseModel


class Visitor(BaseModel):
    visitorId: int
    fullName: str
    idNumber: Optional[str] = None
    phone: Optional[str] = None
    companyName: Optional[str] = None
    email: Optional[str] = None
    # Thông tin lịch hẹn
    appointmentDate: Optional[str] = None  # dạng YYYY-MM-DD
    appointmentTime: Optional[str] = None  # dạng HH:MM
    hostName: Optional[str] = None
    department: Optional[str] = None  # Phòng ban cần gặp
    isPreRegistration: bool = True
    qrToken: Optional[str] = None


class PagedResult(BaseModel):
    items: List["Visitor"]
    pageNumber: int
    pageSize: int
    totalRecords: int
    totalPages: int


class CreateVisitorDto(BaseModel):
    fullName: str
    idNumber: Optional[str] = None
    phone: Optional[str] = None
    companyName: Optional[str] = None
    email: Optional[str] = None
    appointmentDate: Optional[str] = None
    appointmentTime: Optional[str] = None
    hostName: Optional[str] = None
    department: Optional[str] = None
    isPreRegistration: Optional[bool] = True


_DATA_FILE = Path(__file__).with_name("visitors_data.json")


def _load_visitors() -> List["Visitor"]:
    if not _DATA_FILE.exists():
        # Seed with demo data on first run
        return [
            Visitor(
                visitorId=1,
                fullName="Nguyen Van A",
                idNumber="012345678901",
                phone="0909000001",
                companyName="ABC",
                isPreRegistration=True,
                qrToken=f"VISIT-{uuid4().hex[:8]}",
            ),
            Visitor(
                visitorId=2,
                fullName="Tran Thi B",
                idNumber="012345678902",
                phone="0909000002",
                companyName="XYZ",
                isPreRegistration=True,
                qrToken=f"VISIT-{uuid4().hex[:8]}",
            ),
        ]

    try:
        with _DATA_FILE.open("r", encoding="utf-8") as f:
            raw = json.load(f)
        visitors = [Visitor(**item) for item in raw]
        changed = False
        for v in visitors:
            if v.qrToken is None:
                v.qrToken = f"VISIT-{uuid4().hex[:8]}"
                changed = True
        if changed:
            save_visitors(visitors)
        return visitors
    except Exception:
        # If file is corrupted, start with empty list
        return []


def save_visitors(visitors: List["Visitor"]) -> None:
    _DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with _DATA_FILE.open("w", encoding="utf-8") as f:
        json.dump(
            [v.model_dump() for v in visitors],
            f,
            ensure_ascii=False,
            indent=2,
        )


VISITORS: List[Visitor] = _load_visitors()

