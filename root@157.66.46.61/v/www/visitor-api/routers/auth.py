from fastapi import APIRouter, HTTPException, status

from auth_models import LoginRequest, LoginResponse, USERS
from logging_config import logger
from security import create_access_token_for_role


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    matched_user = next(
        (u for u in USERS if u.username == payload.username and u.password == payload.password),
        None,
    )
    if not matched_user:
        logger.info("Login failed for username=%s", payload.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    access_token = create_access_token_for_role(matched_user.role)
    logger.info("Login success for username=%s with role=%s", matched_user.username, matched_user.role.value)

    return LoginResponse(
        accessToken=access_token,
        username=matched_user.username,
        fullName=matched_user.fullName,
        role=matched_user.role,
    )

