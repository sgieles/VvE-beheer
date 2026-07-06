from datetime import date, datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.payment import ContributionPayment
from app.models.appartement import Appartement
from app.models.financial import ContributionPlan
from app.models.vve import VvE
from app.core.dependencies import get_current_user, get_current_beheerder, require_vve_access
from app.schemas.payments import PaymentOut, PaymentUpdate

router = APIRouter(prefix="/api/vves/{vve_id}/payments", tags=["payments"])


def _check(vve_id: int, user: User, db: Session):
    require_vve_access(vve_id, user, db)


@router.get("", response_model=list[PaymentOut])
def list_payments(
    vve_id: int,
    year: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check(vve_id, current_user, db)
    return (
        db.query(ContributionPayment)
        .filter(ContributionPayment.vve_id == vve_id, ContributionPayment.period_year == year)
        .order_by(ContributionPayment.appartement_id, ContributionPayment.period_period)
        .all()
    )


@router.post("/generate", response_model=list[PaymentOut], status_code=201)
def generate_payments(
    vve_id: int,
    year: int,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    """Maak betaalrecords aan voor alle actieve appartementen voor het opgegeven jaar.
    Bestaande records worden overgeslagen (idempotent)."""
    _check(vve_id, current_user, db)

    vve = db.query(VvE).filter(VvE.id == vve_id).first()
    if not vve:
        raise HTTPException(status_code=404, detail="VvE niet gevonden")

    # Meest recente actieve bijdrageplan
    plan = (
        db.query(ContributionPlan)
        .filter(ContributionPlan.vve_id == vve_id)
        .order_by(ContributionPlan.effective_from.desc())
        .first()
    )
    if not plan:
        raise HTTPException(status_code=400, detail="Geen bijdrageplan gevonden. Maak eerst een bijdrageplan aan.")

    appartementen = (
        db.query(Appartement)
        .filter(Appartement.vve_id == vve_id, Appartement.is_active == True)  # noqa: E712
        .all()
    )
    if not appartementen:
        raise HTTPException(status_code=400, detail="Geen actieve appartementen gevonden.")

    periods = 12 if vve.contribution_frequency == "monthly" else 4
    share_denom = vve.share_denominator or 1

    created = 0
    for app in appartementen:
        aandeel = Decimal(str(app.aandeel))
        expected = (plan.amount_per_period * aandeel / Decimal(str(share_denom))).quantize(Decimal("0.01"))
        for period in range(1, periods + 1):
            exists = db.query(ContributionPayment).filter(
                ContributionPayment.appartement_id == app.id,
                ContributionPayment.period_year == year,
                ContributionPayment.period_period == period,
            ).first()
            if not exists:
                db.add(ContributionPayment(
                    vve_id=vve_id,
                    appartement_id=app.id,
                    period_year=year,
                    period_period=period,
                    expected_amount=expected,
                ))
                created += 1

    db.commit()
    return (
        db.query(ContributionPayment)
        .filter(ContributionPayment.vve_id == vve_id, ContributionPayment.period_year == year)
        .order_by(ContributionPayment.appartement_id, ContributionPayment.period_period)
        .all()
    )


@router.patch("/{payment_id}", response_model=PaymentOut)
def update_payment(
    vve_id: int,
    payment_id: int,
    data: PaymentUpdate,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check(vve_id, current_user, db)
    payment = db.query(ContributionPayment).filter(
        ContributionPayment.id == payment_id,
        ContributionPayment.vve_id == vve_id,
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Betaling niet gevonden")

    if data.paid is True:
        payment.paid_at = data.paid_at or date.today()
        payment.paid_amount = data.paid_amount or payment.expected_amount
    elif data.paid is False:
        payment.paid_at = None
        payment.paid_amount = None
    else:
        if data.paid_amount is not None:
            payment.paid_amount = data.paid_amount
        if data.paid_at is not None:
            payment.paid_at = data.paid_at

    if data.notes is not None:
        payment.notes = data.notes

    db.commit()
    db.refresh(payment)
    return payment


@router.get("/summary", response_model=dict)
def payment_summary(
    vve_id: int,
    year: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Samenvatting: totaal verwacht, betaald, openstaand, achterstallig."""
    _check(vve_id, current_user, db)
    payments = (
        db.query(ContributionPayment)
        .filter(ContributionPayment.vve_id == vve_id, ContributionPayment.period_year == year)
        .all()
    )
    today = date.today()
    vve = db.query(VvE).filter(VvE.id == vve_id).first()
    periods = 12 if vve and vve.contribution_frequency == "monthly" else 4

    def period_end(p: int) -> date:
        if periods == 12:
            if p == 12:
                return date(year, 12, 31)
            return date(year, p + 1, 1)
        else:
            ends = {1: date(year, 3, 31), 2: date(year, 6, 30), 3: date(year, 9, 30), 4: date(year, 12, 31)}
            return ends[p]

    total_expected = sum(float(p.expected_amount) for p in payments)
    total_paid = sum(float(p.paid_amount or 0) for p in payments if p.paid_at)
    overdue = sum(
        float(p.expected_amount)
        for p in payments
        if not p.paid_at and period_end(p.period_period) < today
    )
    pending = total_expected - total_paid - overdue
    return {
        "total_expected": total_expected,
        "total_paid": total_paid,
        "overdue": overdue,
        "pending": pending,
        "pct_paid": round(total_paid / total_expected * 100, 1) if total_expected > 0 else 0,
    }
