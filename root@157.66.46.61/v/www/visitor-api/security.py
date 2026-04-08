from enum import Enum
from typing import Dict, Optional
from uuid import uuid4

from fastapi import Depends, Header, HTTPException, status


class Role(str, Enum):
    admin = "Admin"
    security = "Security"
    employee = "Employee"


SESSION_TOKENS: Dict[str, Role] = {}


def create_access_token_for_role(role: Role) -> str:
    token = uuid4().hex
    SESSION_TOKENS[token] = role
    return token


def _get_token_from_authorization_header(
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
        )

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization token",
        )
    return token


def get_current_role(
    token: str = Depends(_get_token_from_authorization_header),
) -> "Role":
    role = SESSION_TOKENS.get(token)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return role


def require_roles(*allowed_roles: "Role"):
    def dependency(current_role: "Role" = Depends(get_current_role)):
        if current_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return current_role

    return dependency

