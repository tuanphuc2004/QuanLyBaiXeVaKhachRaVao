from __future__ import annotations

import shutil
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from plate_recognition_models import (
    PLATE_RECOGNITIONS,
    PlateRecognitionCandidate,
    PlateRecognitionStatus,
    infer_vehicle_type_from_plate,
    normalize_vehicle_type,
    save_plate_recognitions,
)
from security import Role, require_roles
from media_store import get_media_dir, safe_unlink, to_media_path
from plate_ocr import ocr_plate_from_jpeg_bytes, normalize_plate_text
from visit_models import Visit, VISITS, save_visits


router = APIRouter(prefix="/plate-recognitions", tags=["plate-recognitions"])


class PlateRecognitionCreateRequest(BaseModel):
    plateNumber: str
    vehicleType: Optional[str] = None
    confidence: Optional[float] = None


class PlateRecognitionConfirmRequest(BaseModel):
    qrOrIdNumber: str
    vehiclePlate: str
    vehicleType: str
    badgeNumber: str = ""


@router.post("", response_model=PlateRecognitionCandidate)
def create_plate_recognition(
    payload: PlateRecognitionCreateRequest,
    current_role: Role = Depends(require_roles(Role.admin, Role.security)),
) -> PlateRecognitionCandidate:
    now = datetime.now()
    next_id = max((c.candidateId for c in PLATE_RECOGNITIONS), default=0) + 1

    plate = (payload.plateNumber or "").strip()
    if not plate:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="plateNumber is required")

    if payload.vehicleType:
        vehicle_type = normalize_vehicle_type(payload.vehicleType)
    else:
        vehicle_type, inferred_confidence = infer_vehicle_type_from_plate(plate)
        if payload.confidence is None:
            payload.confidence = inferred_confidence

    candidate = PlateRecognitionCandidate(
        candidateId=next_id,
        plateNumber=plate,
        vehicleType=vehicle_type,
        confidence=payload.confidence,
        createdAt=now,
        status=PlateRecognitionStatus.pending,
        decidedAt=None,
        plateImageRelativePath=None,
    )

    PLATE_RECOGNITIONS.append(candidate)
    save_plate_recognitions(PLATE_RECOGNITIONS)
    return candidate


@router.get("/pending", response_model=List[PlateRecognitionCandidate])
def list_pending_plate_recognitions(
    limit: int = 5,
    current_role: Role = Depends(require_roles(Role.admin, Role.security)),
) -> List[PlateRecognitionCandidate]:
    items = [c for c in PLATE_RECOGNITIONS if c.status == PlateRecognitionStatus.pending]
    items.sort(key=lambda c: c.createdAt, reverse=True)
    if limit and limit > 0:
        return items[:limit]
    return items


@router.post("/{candidate_id}/confirm", response_model=Visit)
def confirm_plate_recognition(
    candidate_id: int,
    payload: PlateRecognitionConfirmRequest,
    current_role: Role = Depends(require_roles(Role.admin, Role.security)),
) -> Visit:
    candidate = next((c for c in PLATE_RECOGNITIONS if c.candidateId == candidate_id), None)
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    if candidate.status != PlateRecognitionStatus.pending:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Candidate already decided")

    plate = (payload.vehiclePlate or "").strip() or candidate.plateNumber
    vehicle_type = normalize_vehicle_type(payload.vehicleType)
    qr_or_id = (payload.qrOrIdNumber or "").strip() or plate
    badge = (payload.badgeNumber or "").strip()

    # Update candidate snapshot.
    candidate.plateNumber = plate
    candidate.vehicleType = vehicle_type
    candidate.status = PlateRecognitionStatus.confirmed
    candidate.decidedAt = datetime.now()
    save_plate_recognitions(PLATE_RECOGNITIONS)

    # Create a real check-in visit record.
    visit_id = max((v.visitId for v in VISITS), default=0) + 1
    visit = Visit(
        visitId=visit_id,
        qrOrIdNumber=qr_or_id,
        vehiclePlate=plate,
        vehicleType=vehicle_type,
        badgeNumber=badge,
        checkInTime=datetime.now(),
        checkOutTime=None,
        vehiclePlateImageRelativePath=None,
    )

    # Move plate image to visit media directory.
    if candidate.plateImageRelativePath:
        try:
            src = to_media_path(candidate.plateImageRelativePath)
            dest_rel = f"visits/{visit_id}.jpg"
            dest = to_media_path(dest_rel)
            dest.parent.mkdir(parents=True, exist_ok=True)
            if src.exists():
                shutil.move(str(src), str(dest))
                visit.vehiclePlateImageRelativePath = dest_rel
                candidate.plateImageRelativePath = None
        except Exception:
            # If move fails, continue without image.
            visit.vehiclePlateImageRelativePath = None

    VISITS.append(visit)
    save_visits(VISITS)
    return visit


@router.post("/{candidate_id}/reject", response_model=PlateRecognitionCandidate)
def reject_plate_recognition(
    candidate_id: int,
    current_role: Role = Depends(require_roles(Role.admin, Role.security)),
) -> PlateRecognitionCandidate:
    candidate = next((c for c in PLATE_RECOGNITIONS if c.candidateId == candidate_id), None)
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    if candidate.status != PlateRecognitionStatus.pending:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Candidate already decided")

    candidate.status = PlateRecognitionStatus.rejected
    candidate.decidedAt = datetime.now()
    # If there is an uploaded image and it won't be confirmed, delete it.
    if candidate.plateImageRelativePath:
        safe_unlink(to_media_path(candidate.plateImageRelativePath))
        candidate.plateImageRelativePath = None
    save_plate_recognitions(PLATE_RECOGNITIONS)
    return candidate


@router.post("/with-image", response_model=PlateRecognitionCandidate)
async def create_plate_recognition_with_image(
    plateNumber: str = Form(...),
    vehicleType: Optional[str] = Form(None),
    confidence: Optional[float] = Form(None),
    image: UploadFile = File(...),
    current_role: Role = Depends(require_roles(Role.admin, Role.security)),
) -> PlateRecognitionCandidate:
    """
    MVP endpoint: accept camera image + the recognized plate string (plateNumber) from the client.
    Backend only stores the image and creates a pending record for security/admin to confirm.
    """
    now = datetime.now()
    next_id = max((c.candidateId for c in PLATE_RECOGNITIONS), default=0) + 1

    plate = (plateNumber or "").strip()
    if not plate:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="plateNumber is required")

    if vehicleType:
        vehicle_type = normalize_vehicle_type(vehicleType)
    else:
        vehicle_type, inferred_confidence = infer_vehicle_type_from_plate(plate)
        if confidence is None:
            confidence = inferred_confidence

    # Save uploaded image under: media/plate/<candidateId>.jpg
    # We do not try to re-encode; just store the original bytes as .jpg for simplicity.
    uploads_dir = get_media_dir() / "plate"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{next_id}.jpg"
    relative_path = f"plate/{file_name}"
    abs_path = to_media_path(relative_path)

    data = await image.read()
    with abs_path.open("wb") as f:
        f.write(data)

    candidate = PlateRecognitionCandidate(
        candidateId=next_id,
        plateNumber=plate,
        vehicleType=vehicle_type,
        confidence=confidence,
        createdAt=now,
        status=PlateRecognitionStatus.pending,
        decidedAt=None,
        plateImageRelativePath=relative_path,
    )

    PLATE_RECOGNITIONS.append(candidate)
    save_plate_recognitions(PLATE_RECOGNITIONS)
    return candidate


@router.post("/ocr-with-image", response_model=PlateRecognitionCandidate)
async def ocr_plate_with_image(
    image: UploadFile = File(...),
    current_role: Role = Depends(require_roles(Role.admin, Role.security)),
) -> PlateRecognitionCandidate:
    """
    MVP: camera image -> OCR -> create pending candidate.
    Backend will only create pending when plate text is recognized.
    """
    if not image:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="image is required")

    raw_bytes = await image.read()
    plate, confidence = ocr_plate_from_jpeg_bytes(raw_bytes)
    if not plate:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Could not recognize plate")

    normalized = normalize_plate_text(plate)

    # Dedupe: if there is already a pending candidate with the same plate,
    # overwrite its image and return it.
    pending_existing = next(
        (c for c in PLATE_RECOGNITIONS if c.status == PlateRecognitionStatus.pending and normalize_plate_text(c.plateNumber) == normalized),
        None,
    )
    now = datetime.now()

    if pending_existing:
        if pending_existing.plateImageRelativePath:
            abs_path = to_media_path(pending_existing.plateImageRelativePath)
        else:
            pending_existing.plateImageRelativePath = f"plate/{pending_existing.candidateId}.jpg"
            abs_path = to_media_path(pending_existing.plateImageRelativePath)

        uploads_dir = abs_path.parent
        uploads_dir.mkdir(parents=True, exist_ok=True)
        with abs_path.open("wb") as f:
            f.write(raw_bytes)

        pending_existing.plateNumber = pending_existing.plateNumber or normalized
        pending_existing.confidence = confidence
        pending_existing.vehicleType, _ = infer_vehicle_type_from_plate(normalized)
        save_plate_recognitions(PLATE_RECOGNITIONS)
        return pending_existing

    now = datetime.now()
    next_id = max((c.candidateId for c in PLATE_RECOGNITIONS), default=0) + 1
    vehicle_type, inferred_confidence = infer_vehicle_type_from_plate(normalized)

    relative_path = f"plate/{next_id}.jpg"
    abs_path = to_media_path(relative_path)
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    with abs_path.open("wb") as f:
        f.write(raw_bytes)

    candidate = PlateRecognitionCandidate(
        candidateId=next_id,
        plateNumber=normalized,
        vehicleType=vehicle_type,
        confidence=confidence if confidence is not None and confidence > 0 else inferred_confidence,
        createdAt=now,
        status=PlateRecognitionStatus.pending,
        decidedAt=None,
        plateImageRelativePath=relative_path,
    )

    PLATE_RECOGNITIONS.append(candidate)
    save_plate_recognitions(PLATE_RECOGNITIONS)
    return candidate

