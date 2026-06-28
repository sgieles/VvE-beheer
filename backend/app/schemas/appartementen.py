from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel


class AppartementBase(BaseModel):
    naam: str
    nummer: str | None = None
    eigenaar_naam: str | None = None
    aandeel: Decimal = Decimal("1")


class AppartementCreate(AppartementBase):
    pass


class AppartementUpdate(BaseModel):
    naam: str | None = None
    nummer: str | None = None
    eigenaar_naam: str | None = None
    aandeel: Decimal | None = None
    is_active: bool | None = None


class AppartementOut(AppartementBase):
    id: int
    vve_id: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
