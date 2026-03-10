"""Base database models for KOLO CRM"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict
from datetime import datetime, timezone
import uuid


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str = Field(default_factory=lambda: f"user_{uuid.uuid4().hex[:12]}")
    email: str
    phone: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None
    auth_provider: str = "google"
    locale: Optional[str] = None
    country: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    subscription_status: str = "none"
    subscription_id: Optional[str] = None
    trial_ends_at: Optional[datetime] = None
    subscription_ends_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str = Field(default_factory=lambda: f"sess_{uuid.uuid4().hex}")
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    task_id: str = Field(default_factory=lambda: f"task_{uuid.uuid4().hex[:12]}")
    user_id: str
    prospect_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    task_type: str = "follow_up"
    due_date: datetime
    completed: bool = False
    completed_at: Optional[datetime] = None
    auto_generated: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Prospect(BaseModel):
    model_config = ConfigDict(extra="ignore")
    prospect_id: str = Field(default_factory=lambda: f"prospect_{uuid.uuid4().hex[:12]}")
    user_id: str
    full_name: str
    phone: str
    email: str
    source: str = "manual"
    status: str = "new"
    notes: Optional[str] = None
    last_activity_date: Optional[datetime] = None
    next_task_id: Optional[str] = None
    next_task_date: Optional[datetime] = None
    next_task_title: Optional[str] = None
    score: Optional[str] = None
    score_calculated_at: Optional[datetime] = None
    score_manual_override: bool = False
    sms_opt_out: bool = False
    sms_history: Optional[List[Dict]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PaymentTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    transaction_id: str = Field(default_factory=lambda: f"txn_{uuid.uuid4().hex[:12]}")
    session_id: str
    user_email: Optional[str] = None
    amount: float
    currency: str
    payment_status: str = "pending"
    metadata: Optional[Dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PaymentSuccess(BaseModel):
    model_config = ConfigDict(extra="ignore")
    token: str = Field(default_factory=lambda: f"paysuccess_{uuid.uuid4().hex}")
    email: str
    session_id: str
    expires_at: datetime
    used: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
