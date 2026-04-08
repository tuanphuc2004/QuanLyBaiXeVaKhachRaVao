from fastapi import APIRouter, Depends, HTTPException, Response, status

from auth_models import (
    CreateUserRequest,
    LoginRequest,
    LoginResponse,
    UpdateUserRequest,
    User,
    UserPublic,
    USERS,
)
from logging_config import logger
from security import Role, create_access_token_for_role, require_roles


router = APIRouter(prefix="/auth", tags=["auth"])


def _count_admins() -> int:
    return sum(1 for u in USERS if u.role == Role.admin)


def _to_public(u: User) -> UserPublic:
    return UserPublic(username=u.username, fullName=u.fullName, role=u.role)


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


@router.get("/users", response_model=list[UserPublic])
def list_users(_: Role = Depends(require_roles(Role.admin))) -> list[UserPublic]:
    return [_to_public(u) for u in USERS]


@router.post("/users", response_model=UserPublic)
def create_user(
    payload: CreateUserRequest,
    _: Role = Depends(require_roles(Role.admin)),
) -> UserPublic:
    uname = payload.username.strip()
    if not uname:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username is required")
    if any(u.username == uname for u in USERS):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
    user = User(
        username=uname,
        fullName=payload.fullName.strip(),
        role=payload.role,
        password=payload.password,
    )
    USERS.append(user)
    logger.info("Admin created user username=%s role=%s", user.username, user.role.value)
    return _to_public(user)


@router.patch("/users/{username}", response_model=UserPublic)
def update_user(
    username: str,
    payload: UpdateUserRequest,
    _: Role = Depends(require_roles(Role.admin)),
) -> UserPublic:
    key = username.strip()
    idx = next((i for i, u in enumerate(USERS) if u.username == key), None)
    if idx is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    current = USERS[idx]
    new_role = payload.role if payload.role is not None else current.role
    if payload.fullName is not None:
        stripped = payload.fullName.strip()
        if not stripped:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Full name cannot be empty",
            )
        new_full = stripped
    else:
        new_full = current.fullName

    if current.role == Role.admin and new_role != Role.admin and _count_admins() <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the last administrator role",
        )

    new_password = current.password
    if payload.password is not None and payload.password.strip() != "":
        if len(payload.password) < 4:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 4 characters",
            )
        new_password = payload.password

    updated = User(
        username=current.username,
        fullName=new_full,
        role=new_role,
        password=new_password,
    )
    USERS[idx] = updated
    logger.info("Admin updated user username=%s role=%s", updated.username, updated.role.value)
    return _to_public(updated)


@router.delete("/users/{username}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    username: str,
    _: Role = Depends(require_roles(Role.admin)),
) -> Response:
    key = username.strip()
    idx = next((i for i, u in enumerate(USERS) if u.username == key), None)
    if idx is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target = USERS[idx]
    if target.role == Role.admin and _count_admins() <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the last administrator account",
        )

    USERS.pop(idx)
    logger.info("Admin deleted user username=%s", key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

