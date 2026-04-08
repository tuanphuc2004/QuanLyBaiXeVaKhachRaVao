from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Query, HTTPException, status

from logging_config import logger
from models import CreateVisitorDto, PagedResult, VISITORS, Visitor, save_visitors
from security import Role, require_roles
from visit_models import VISITS
from email_utils import send_appointment_email


router = APIRouter(prefix="/visitors", tags=["visitors"])


@router.get("", response_model=PagedResult)
def get_visitors(
    pageNumber: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=2000),
    searchTerm: Optional[str] = None,
    current_role: Role = Depends(require_roles(Role.admin, Role.employee)),
):
    logger.info(
        "Get visitors requested by role=%s, page=%s, size=%s, search=%s",
        current_role.value,
        pageNumber,
        pageSize,
        searchTerm,
    )
    # Trả về toàn bộ khách để phía frontend có thể lọc theo trạng thái
    filtered = list(VISITORS)
    if searchTerm:
        term = searchTerm.lower()
        filtered = [
            v
            for v in filtered
            if term in v.fullName.lower()
            or (v.idNumber and term in v.idNumber.lower())
            or (v.phone and term in v.phone.lower())
        ]

    total_records = len(filtered)
    start = (pageNumber - 1) * pageSize
    end = start + pageSize
    page_items = filtered[start:end]

    total_pages = (total_records + pageSize - 1) // pageSize if pageSize > 0 else 1

    return PagedResult(
        items=page_items,
        pageNumber=pageNumber,
        pageSize=pageSize,
        totalRecords=total_records,
        totalPages=total_pages,
    )


@router.get("/pending-approval-count")
def get_pending_approval_count(
    current_role: Role = Depends(require_roles(Role.admin)),
):
    """Count visitors waiting for admin approval (isPreRegistration is False)."""
    count = sum(1 for v in VISITORS if not v.isPreRegistration)
    return {"count": count}


@router.post("", response_model=Visitor)
def create_visitor(
    dto: CreateVisitorDto,
    current_role: Role = Depends(require_roles(Role.admin, Role.employee)),
):
    return _create_visitor_common(dto, created_by=current_role.value, is_public=False)


def _create_visitor_common(
    dto: CreateVisitorDto,
    created_by: str,
    is_public: bool,
) -> Visitor:
    # Generate simple incremental id
    next_id = max((v.visitorId for v in VISITORS), default=0) + 1

    # Kiểm tra trùng lịch nếu có đủ thông tin host + ngày + giờ
    if dto.hostName and dto.appointmentDate and dto.appointmentTime:
        host_lower = dto.hostName.strip().lower()
        for existing in VISITORS:
            if (
                existing.hostName
                and existing.appointmentDate
                and existing.appointmentTime
                and existing.hostName.strip().lower() == host_lower
                and existing.appointmentDate == dto.appointmentDate
                and existing.appointmentTime == dto.appointmentTime
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Lịch hẹn đã trùng với người khác, vui lòng chọn lại thời gian.",
                )

    qr_token = f"VISIT-{uuid4().hex[:8]}"

    is_pre_registration: bool
    if is_public:
        # Lịch do khách tự đăng ký sẽ cần admin duyệt nên mặc định False
        is_pre_registration = False
    else:
        is_pre_registration = dto.isPreRegistration if dto.isPreRegistration is not None else True

    visitor = Visitor(
        visitorId=next_id,
        fullName=dto.fullName.strip(),
        idNumber=dto.idNumber,
        phone=dto.phone,
        companyName=dto.companyName,
        email=dto.email,
        appointmentDate=dto.appointmentDate,
        appointmentTime=dto.appointmentTime,
        hostName=dto.hostName,
        department=dto.department,
        isPreRegistration=is_pre_registration,
        qrToken=qr_token,
    )

    VISITORS.append(visitor)
    save_visitors(VISITORS)
    logger.info(
        "Visitor created by %s: id=%s, fullName=%s, is_public=%s",
        created_by,
        visitor.visitorId,
        visitor.fullName,
        is_public,
    )
    return visitor


@router.post("/public-registration", response_model=Visitor)
def public_register_visitor(dto: CreateVisitorDto):
    """
    Endpoint cho khách bên ngoài tự đăng ký lịch hẹn.
    Không yêu cầu đăng nhập; bản ghi sẽ ở trạng thái chờ duyệt (isPreRegistration=False).
    """
    return _create_visitor_common(dto, created_by="public", is_public=True)


@router.get("/available-for-checkin", response_model=PagedResult)
def get_visitors_available_for_checkin(
    pageNumber: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=2000),
    searchTerm: Optional[str] = None,
    current_role: Role = Depends(require_roles(Role.admin, Role.employee)),
):
    logger.info(
        "Get visitors available for check-in requested by role=%s, page=%s, size=%s, search=%s",
        current_role.value,
        pageNumber,
        pageSize,
        searchTerm,
    )
    used_tokens = {v.qrOrIdNumber for v in VISITS}

    filtered = [
        v
        for v in VISITORS
        if not (v.qrToken and v.qrToken in used_tokens)
    ]

    if searchTerm:
        term = searchTerm.lower()
        filtered = [
            v
            for v in filtered
            if term in v.fullName.lower()
            or (v.idNumber and term in v.idNumber.lower())
            or (v.phone and term in v.phone.lower())
        ]

    total_records = len(filtered)
    start = (pageNumber - 1) * pageSize
    end = start + pageSize
    page_items = filtered[start:end]

    total_pages = (total_records + pageSize - 1) // pageSize if pageSize > 0 else 1

    return PagedResult(
        items=page_items,
        pageNumber=pageNumber,
        pageSize=pageSize,
        totalRecords=total_records,
        totalPages=total_pages,
    )


@router.post("/{visitor_id}/approve", response_model=Visitor)
def approve_visitor(
    visitor_id: int,
    current_role: Role = Depends(require_roles(Role.admin)),
):
    """
    Admin xác nhận lịch hẹn cho khách được tạo tại quầy lễ tân.
    Sau khi xác nhận, khách được coi là đã đăng ký trước và có thể check-in.
    """
    for visitor in VISITORS:
        if visitor.visitorId == visitor_id:
            if visitor.isPreRegistration:
                return visitor

            visitor.isPreRegistration = True
            if visitor.qrToken is None:
                visitor.qrToken = f"VISIT-{uuid4().hex[:8]}"

            save_visitors(VISITORS)
            send_appointment_email(visitor)
            logger.info(
                "Visitor approved by admin: id=%s, fullName=%s",
                visitor.visitorId,
                visitor.fullName,
            )
            return visitor

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Không tìm thấy khách để xác nhận lịch",
    )

