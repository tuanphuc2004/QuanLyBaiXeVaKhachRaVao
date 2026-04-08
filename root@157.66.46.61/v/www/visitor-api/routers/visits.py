from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, HTTPException, status

from logging_config import logger
from security import Role, require_roles
from visit_models import VISITS, CheckinRequest, CheckoutRequest, Visit, save_visits
from media_store import to_media_path, safe_unlink


router = APIRouter(prefix="/visits", tags=["visits"])


def _parse_date(d: str) -> Optional[datetime]:
    try:
        return datetime.strptime(d.strip()[:10], "%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def _end_of_day(d: datetime) -> datetime:
    return d.replace(hour=23, minute=59, second=59, microsecond=999999)


@router.post("/checkin", response_model=Visit)
def checkin(
    payload: CheckinRequest,
    current_role: Role = Depends(
        require_roles(Role.admin, Role.security, Role.employee)
    ),
) -> Visit:
    visit_id = max((v.visitId for v in VISITS), default=0) + 1
    visit = Visit(
        visitId=visit_id,
        qrOrIdNumber=payload.qrOrIdNumber.strip(),
        vehiclePlate=payload.vehiclePlate.strip(),
        vehicleType=payload.vehicleType,
        badgeNumber=payload.badgeNumber.strip(),
        checkInTime=datetime.now(),
    )
    VISITS.append(visit)
    save_visits(VISITS)
    logger.info(
        "Check-in created by role=%s visitId=%s",
        current_role.value,
        visit_id,
    )
    return visit


@router.post("/checkout", response_model=Visit)
def checkout(
    payload: CheckoutRequest,
    current_role: Role = Depends(
        require_roles(Role.admin, Role.security, Role.employee)
    ),
) -> Visit:
    token = payload.qrOrBadge.strip()
    for visit in reversed(VISITS):
        if visit.checkOutTime is None and (
            visit.badgeNumber == token or visit.qrOrIdNumber == token
        ):
            visit.checkOutTime = datetime.now()

            # Delete plate image after successful checkout.
            if visit.vehiclePlateImageRelativePath:
                safe_unlink(to_media_path(visit.vehiclePlateImageRelativePath))
                visit.vehiclePlateImageRelativePath = None

            logger.info(
                "Check-out updated by role=%s visitId=%s",
                current_role.value,
                visit.visitId,
            )
            save_visits(VISITS)
            return visit

    logger.info(
        "Checkout failed for token=%s by role=%s",
        token,
        current_role.value,
    )
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Không tìm thấy lượt visit đang hoạt động cho mã này",
    )


@router.get("", response_model=List[Visit])
def list_visits(
    fromDate: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    toDate: Optional[str] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    current_role: Role = Depends(
        require_roles(Role.admin, Role.security, Role.employee)
    ),
) -> List[Visit]:
    logger.info("List visits requested by role=%s from=%s to=%s", current_role.value, fromDate, toDate)
    result = list(VISITS)
    start_dt = _parse_date(fromDate) if fromDate else None
    end_dt = _parse_date(toDate) if toDate else None
    if end_dt is not None:
        end_dt = _end_of_day(end_dt)
    if start_dt is not None or end_dt is not None:
        filtered = []
        for v in result:
            check_in = v.checkInTime if isinstance(v.checkInTime, datetime) else datetime.fromisoformat(str(v.checkInTime).replace("Z", "+00:00"))
            check_in_date = check_in.replace(hour=0, minute=0, second=0, microsecond=0)
            if start_dt is not None and check_in_date < start_dt:
                continue
            if end_dt is not None and check_in_date > end_dt:
                continue
            filtered.append(v)
        result = filtered
    return sorted(result, key=lambda v: v.checkInTime, reverse=True)

