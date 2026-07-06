from decimal import Decimal
from datetime import datetime, date
from pydantic import BaseModel


class MJOPUploadOut(BaseModel):
    id: int
    vve_id: int
    original_filename: str
    status: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class MJOPItemBase(BaseModel):
    description: str
    category: str | None = None
    planned_year: int
    planned_quarter: int | None = None  # 1-4
    planned_amount: Decimal
    notes: str | None = None


class MJOPItemCreate(MJOPItemBase):
    pass


class MJOPItemUpdate(BaseModel):
    description: str | None = None
    category: str | None = None
    planned_year: int | None = None
    planned_quarter: int | None = None
    planned_amount: Decimal | None = None
    actual_amount: Decimal | None = None
    status: str | None = None
    notes: str | None = None


class MJOPItemOut(MJOPItemBase):
    id: int
    vve_id: int
    mjop_upload_id: int
    actual_amount: Decimal | None
    status: str
    manually_adjusted: bool
    quotes: list["QuoteOut"] = []

    model_config = {"from_attributes": True}


class QuoteBase(BaseModel):
    supplier_name: str
    quoted_amount: Decimal
    notes: str | None = None


class QuoteCreate(QuoteBase):
    mjop_item_id: int


class QuoteApprove(BaseModel):
    final_amount: Decimal | None = None


class QuoteOut(QuoteBase):
    id: int
    vve_id: int
    mjop_item_id: int
    document_path: str | None
    is_approved: bool
    approved_at: datetime | None
    final_amount: Decimal | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReserveFondsEntryCreate(BaseModel):
    entry_date: date
    amount: Decimal
    description: str | None = None


class ReserveFondsEntryOut(ReserveFondsEntryCreate):
    id: int
    vve_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ContributionPlanCreate(BaseModel):
    amount_per_period: Decimal
    effective_from: date
    effective_to: date | None = None
    notes: str | None = None


class ContributionPlanUpdate(BaseModel):
    effective_to: date | None = None
    notes: str | None = None


class ContributionPlanOut(ContributionPlanCreate):
    id: int
    vve_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ScenarioResult(BaseModel):
    """Berekend scenario voor tekortdekking."""
    scenario_type: str
    description: str
    # Impact per eigenaar per periode (maand of kwartaal)
    impact_per_period_per_aandeel: Decimal
    total_shortfall: Decimal
    coverage_start_year: int
    details: dict


class FinancialDashboard(BaseModel):
    """Overzicht voor het financieel dashboard."""
    vve_id: int
    current_reservefonds_balance: Decimal
    contribution_frequency: str
    current_contribution_per_period: Decimal
    total_planned_costs_next_5_years: Decimal
    total_planned_costs_next_10_years: Decimal
    projected_balance_by_year: list[dict]  # [{year, balance, costs, contributions}]
    shortfalls: list[dict]  # [{year, quarter, amount}]
    scenarios: list[ScenarioResult]
