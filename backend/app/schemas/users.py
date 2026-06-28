from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, EmailStr


class VvEBase(BaseModel):
    name: str
    address: str | None = None
    kvk_number: str | None = None
    contribution_frequency: str = "monthly"
    share_denominator: int = 1


class VvECreate(VvEBase):
    pass


class VvEOut(VvEBase):
    id: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str | None = None
    role: str = "eigenaar"
    aandeel: Decimal | None = None
    appartement_nummer: str | None = None
    address: str | None = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    aandeel: Decimal | None = None
    appartement_nummer: str | None = None
    address: str | None = None
    role: str | None = None
    is_active: bool | None = None


class UserOut(UserBase):
    id: int
    vve_id: int | None
    email: str  # override: sla EmailStr-validatie over bij output
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserMe(UserOut):
    vve: VvEOut | None = None
