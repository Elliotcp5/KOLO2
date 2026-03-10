"""Request and Response models for KOLO API"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class CreateCheckoutRequest(BaseModel):
    origin_url: str
    email: Optional[str] = None
    locale: Optional[str] = None
    country: Optional[str] = None


class CreateCheckoutResponse(BaseModel):
    url: str
    session_id: str


class AuthSessionRequest(BaseModel):
    session_id: str


class CreateProspectRequest(BaseModel):
    full_name: str
    phone: str
    email: EmailStr
    source: str = "manual"
    status: str = "new"
    notes: Optional[str] = None


class UpdateProspectRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    source: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class CreateTaskRequest(BaseModel):
    prospect_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    task_type: str = "follow_up"
    due_date: datetime


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    task_type: Optional[str] = None
    due_date: Optional[datetime] = None
    completed: Optional[bool] = None


class GeoResponse(BaseModel):
    country: str
    currency: str
    amount: float
    symbol: str
    locale: str


class CreateAccountRequest(BaseModel):
    payment_token: str
    email: Optional[str] = None
    password: Optional[str] = None


class RegisterRequest(BaseModel):
    """Request for free trial registration (no payment required)"""
    email: str
    password: str
    full_name: str
    phone: str
    country_code: str = "+33"


class LoginRequest(BaseModel):
    email: str
    password: str


class RecoverAccountRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UpdatePhoneRequest(BaseModel):
    phone: str


class UpdateNameRequest(BaseModel):
    name: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class BillingPortalRequest(BaseModel):
    action: str
