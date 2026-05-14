from datetime import datetime, date, timezone
from decimal import Decimal
from sqlalchemy import String, DateTime, Date, Enum, ForeignKey, Numeric, Integer, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class MJOPUpload(Base):
    __tablename__ = "mjop_uploads"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vve_id: Mapped[int] = mapped_column(ForeignKey("vves.id"), index=True)
    original_filename: Mapped[str] = mapped_column(String(300))
    stored_filename: Mapped[str] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(
        Enum("processing", "active", "archived", name="mjop_status_enum"),
        default="processing",
    )
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    vve: Mapped["VvE"] = relationship(back_populates="mjop_uploads")  # noqa: F821
    items: Mapped[list["MJOPItem"]] = relationship(back_populates="upload", cascade="all, delete-orphan")


class MJOPItem(Base):
    __tablename__ = "mjop_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vve_id: Mapped[int] = mapped_column(ForeignKey("vves.id"), index=True)
    mjop_upload_id: Mapped[int] = mapped_column(ForeignKey("mjop_uploads.id"), index=True)
    description: Mapped[str] = mapped_column(String(500))
    category: Mapped[str | None] = mapped_column(String(200))

    # Tijdplanning: jaar altijd verplicht, kwartaal optioneel (1-4)
    planned_year: Mapped[int] = mapped_column(Integer)
    planned_quarter: Mapped[int | None] = mapped_column(Integer)  # 1, 2, 3 of 4

    planned_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    actual_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))

    status: Mapped[str] = mapped_column(
        Enum("planned", "quoted", "approved", "completed", name="mjop_item_status_enum"),
        default="planned",
    )
    notes: Mapped[str | None] = mapped_column(Text)
    # True als beheerder de post handmatig heeft verschoven
    manually_adjusted: Mapped[bool] = mapped_column(Boolean, default=False)

    upload: Mapped["MJOPUpload"] = relationship(back_populates="items")
    quotes: Mapped[list["Quote"]] = relationship(back_populates="mjop_item", cascade="all, delete-orphan")


class Quote(Base):
    __tablename__ = "quotes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vve_id: Mapped[int] = mapped_column(ForeignKey("vves.id"), index=True)
    mjop_item_id: Mapped[int] = mapped_column(ForeignKey("mjop_items.id"), index=True)
    supplier_name: Mapped[str] = mapped_column(String(200))
    quoted_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    document_path: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)

    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    # Bijgesteld bedrag na goedkeuring (meerwerk etc.)
    final_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    mjop_item: Mapped["MJOPItem"] = relationship(back_populates="quotes")


class ReserveFondsEntry(Base):
    """Saldo-mutaties van het reservefonds."""
    __tablename__ = "reservefonds_entries"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vve_id: Mapped[int] = mapped_column(ForeignKey("vves.id"), index=True)
    entry_date: Mapped[date] = mapped_column(Date)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))  # positief = storting, negatief = onttrekking
    description: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    vve: Mapped["VvE"] = relationship(back_populates="reservefonds_entries")  # noqa: F821


class ContributionPlan(Base):
    """VvE-bijdrage per periode (maand of kwartaal)."""
    __tablename__ = "contribution_plans"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vve_id: Mapped[int] = mapped_column(ForeignKey("vves.id"), index=True)
    amount_per_period: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    effective_from: Mapped[date] = mapped_column(Date)
    effective_to: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    vve: Mapped["VvE"] = relationship(back_populates="contribution_plans")  # noqa: F821


class ScenarioChoice(Base):
    """Vastgelegde scenariokeuze van de beheerder."""
    __tablename__ = "scenario_choices"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vve_id: Mapped[int] = mapped_column(ForeignKey("vves.id"), index=True)
    scenario_type: Mapped[str] = mapped_column(
        Enum("contribution_increase", "defer_activity", "one_time_levy", name="scenario_type_enum")
    )
    description: Mapped[str | None] = mapped_column(Text)
    chosen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    chosen_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    # JSON blob met parameters van het gekozen scenario
    parameters: Mapped[str | None] = mapped_column(Text)
