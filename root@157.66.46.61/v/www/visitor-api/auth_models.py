from typing import List

from pydantic import BaseModel

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


USERS: List[User] = [
    User(username="admin", fullName="System Administrator", role=Role.admin, password="admin123"),
    User(username="baove", fullName="Bảo Vệ", role=Role.security, password="baove123"),
    User(username="letan", fullName="Lễ Tân", role=Role.employee, password="letan123"),
]

