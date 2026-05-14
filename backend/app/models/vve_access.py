from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class UserVvEAccess(Base):
    """Koppeltabel: beheerder of admin heeft toegang tot meerdere VvE's."""
    __tablename__ = "user_vve_access"
    __table_args__ = (UniqueConstraint("user_id", "vve_id", name="uq_user_vve"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    vve_id: Mapped[int] = mapped_column(ForeignKey("vves.id"), index=True)
