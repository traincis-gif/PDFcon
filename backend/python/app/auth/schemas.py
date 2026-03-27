from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class ApiKeyResponse(BaseModel):
    api_key: str


class UserResponse(BaseModel):
    id: str
    email: str
    plan_id: int
    api_key: str | None
    created_at: str

    model_config = {"from_attributes": True}
