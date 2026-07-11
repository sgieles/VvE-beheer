from datetime import datetime, date, timezone
from decimal import Decimal
from sqlalchemy import String, DateTime, Date, ForeignKey, Numeric, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class ContributionPayment(Base):
    """Bijdragebetaling per appartement per periode."""
    __tablename__ = "contribution_payments"
    __table_args__ = (
        UniqueConstraint("appartement_id", "period_year", "period_period", name="uq_payment_period"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vve_id: Mapped[int] = mapped_column(ForeignKey("vves.id"), index=True)
    appartement_id: Mapped[int] = mapped_column(ForeignKey("appartementen.id"), index=True)
    period_year: Mapped[int] = mapped_column(Integer)
    # 1–12 voor maandelijks, 1–4 voor kwartaal
    period_period: Mapped[int] = mapped_column(Integer)
    expected_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    paid_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    paid_at: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
