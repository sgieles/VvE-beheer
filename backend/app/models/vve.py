from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Enum, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class VvE(Base):
    __tablename__ = "vves"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str | None] = mapped_column(String(300))
    kvk_number: Mapped[str | None] = mapped_column(String(20))
    contribution_frequency: Mapped[str] = mapped_column(
        Enum("monthly", "quarterly", name="contribution_frequency_enum"),
        default="monthly",
    )
    share_denominator: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    users: Mapped[list["User"]] = relationship(back_populates="vve")  # noqa: F821
    appartementen: Mapped[list["Appartement"]] = relationship(back_populates="vve")  # noqa: F821
    mjop_uploads: Mapped[list["MJOPUpload"]] = relationship(back_populates="vve")  # noqa: F821
    meetings: Mapped[list["Meeting"]] = relationship(back_populates="vve")  # noqa: F821
    contribution_plans: Mapped[list["ContributionPlan"]] = relationship(back_populates="vve")  # noqa: F821
    reservefonds_entries: Mapped[list["ReserveFondsEntry"]] = relationship(back_populates="vve")  # noqa: F821
