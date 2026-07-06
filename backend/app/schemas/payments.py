from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel


class PaymentOut(BaseModel):
    id: int
    vve_id: int
    appartement_id: int
    period_year: int
    period_period: int
    expected_amount: Decimal
    paid_amount: Decimal | None
    paid_at: date | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaymentUpdate(BaseModel):
    paid_amount: Decimal | None = None
    paid_at: date | None = None
    notes: str | None = None
    # paid=True → vul paid_at automatisch in als datum niet opgegeven
    paid: bool | None = None
