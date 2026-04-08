from typing import List, Optional

from pydantic import BaseModel, Field

from security import Role


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    accessToken: str
    tokenType: str = "bearer"
    username: str
    fullName: str
    role: Role


class User(BaseModel):
    username: str
    fullName: str
    role: Role
    password: str


class UserPublic(BaseModel):
    username: str
    fullName: str
    role: Role


class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=4)
    fullName: str = Field(..., min_length=1)
    role: Role


class UpdateUserRequest(BaseModel):
    fullName: Optional[str] = None
    role: Optional[Role] = None
    password: Optional[str] = None


USERS: List[User] = [
    User(username="admin", fullName="System Administrator", role=Role.admin, password="admin123"),
    User(username="baove", fullName="Bảo Vệ", role=Role.security, password="baove123"),
    User(username="letan", fullName="Lễ Tân", role=Role.employee, password="letan123"),
    User(username="giamdoc", fullName="Giám đốc", role=Role.director, password="giamdoc123"),
]

