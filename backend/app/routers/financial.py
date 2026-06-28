import os
import shutil
from datetime import date, datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.financial import MJOPUpload, MJOPItem, Quote, ReserveFondsEntry, ContributionPlan
from app.core.dependencies import get_current_user, get_current_beheerder, require_vve_access
from app.core.config import settings
from app.schemas.financial import (
    MJOPUploadOut, MJOPItemOut, MJOPItemCreate, MJOPItemUpdate,
    QuoteCreate, QuoteApprove, QuoteOut,
    ReserveFondsEntryCreate, ReserveFondsEntryOut,
    ContributionPlanCreate, ContributionPlanOut,
)
from app.services.mjop_parser import parse_mjop_file
from app.services.scenario_calculator import (
    FinancialInput, MJOPItemInput, calculate_all_scenarios
)

router = APIRouter(prefix="/api/vves/{vve_id}/financial", tags=["financial"])


def _check_vve_access(vve_id: int, user: User, db: Session):
    require_vve_access(vve_id, user, db)


# --- MJOP Upload ---

def _process_mjop(file_path: str, upload_id: int):
    """Achtergrondtaak: parse het MJOP bestand en sla items op."""
    db = SessionLocal()
    try:
        upload = db.query(MJOPUpload).filter(MJOPUpload.id == upload_id).first()
        if not upload:
            return
        try:
            items = parse_mjop_file(file_path)
            for item_data in items:
                item = MJOPItem(
                    vve_id=upload.vve_id,
                    mjop_upload_id=upload.id,
                    **item_data,
                )
                db.add(item)
            upload.status = "active"
            db.query(MJOPUpload).filter(
                MJOPUpload.vve_id == upload.vve_id,
                MJOPUpload.id != upload.id,
                MJOPUpload.status == "active",
            ).update({"status": "archived"})
            db.commit()
        except Exception as exc:
            import logging
            logging.getLogger(__name__).error("MJOP parse fout: %s", exc, exc_info=True)
            upload.status = "failed"
            db.commit()
    finally:
        db.close()


@router.post("/mjop/upload", response_model=MJOPUploadOut, status_code=status.HTTP_201_CREATED)
async def upload_mjop(
    vve_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check_vve_access(vve_id, current_user, db)
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".xlsx", ".xls", ".xlsm", ".pdf"):
        raise HTTPException(status_code=400, detail="Alleen Excel (.xlsx, .xls) en PDF bestanden zijn toegestaan")

    upload_dir = os.path.join(settings.UPLOAD_DIR, "mjop", str(vve_id))
    os.makedirs(upload_dir, exist_ok=True)
    stored_name = f"{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{file.filename}"
    file_path = os.path.join(upload_dir, stored_name)

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    upload = MJOPUpload(
        vve_id=vve_id,
        original_filename=file.filename,
        stored_filename=stored_name,
        status="processing",
        uploaded_by_id=current_user.id,
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    background_tasks.add_task(_process_mjop, file_path, upload.id)
    return upload


@router.get("/mjop/uploads", response_model=list[MJOPUploadOut])
def list_mjop_uploads(vve_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_vve_access(vve_id, current_user, db)
    return db.query(MJOPUpload).filter(MJOPUpload.vve_id == vve_id).order_by(MJOPUpload.uploaded_at.desc()).all()


# --- MJOP Items ---

@router.get("/mjop/items", response_model=list[MJOPItemOut])
def list_mjop_items(vve_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_vve_access(vve_id, current_user, db)
    # Actieve upload items ophalen
    active_upload = db.query(MJOPUpload).filter(
        MJOPUpload.vve_id == vve_id, MJOPUpload.status == "active"
    ).order_by(MJOPUpload.uploaded_at.desc()).first()
    if not active_upload:
        return []
    items = db.query(MJOPItem).filter(MJOPItem.mjop_upload_id == active_upload.id).all()
    for item in items:
        _ = item.quotes  # eager load
    return items


@router.post("/mjop/items", response_model=MJOPItemOut, status_code=status.HTTP_201_CREATED)
def create_mjop_item(
    vve_id: int,
    data: MJOPItemCreate,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check_vve_access(vve_id, current_user, db)
    active_upload = db.query(MJOPUpload).filter(
        MJOPUpload.vve_id == vve_id, MJOPUpload.status == "active"
    ).order_by(MJOPUpload.uploaded_at.desc()).first()
    if not active_upload:
        raise HTTPException(status_code=400, detail="Geen actief MJOP aanwezig. Upload eerst een MJOP.")
    item = MJOPItem(vve_id=vve_id, mjop_upload_id=active_upload.id, **data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/mjop/items/{item_id}", response_model=MJOPItemOut)
def update_mjop_item(
    vve_id: int,
    item_id: int,
    data: MJOPItemUpdate,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check_vve_access(vve_id, current_user, db)
    item = db.query(MJOPItem).filter(MJOPItem.id == item_id, MJOPItem.vve_id == vve_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="MJOP post niet gevonden")
    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(item, field, value)
    if any(k in updates for k in ("planned_year", "planned_quarter", "planned_amount")):
        item.manually_adjusted = True
    db.commit()
    db.refresh(item)
    return item


# --- Offertes ---

@router.post("/quotes", response_model=QuoteOut, status_code=status.HTTP_201_CREATED)
async def create_quote(
    vve_id: int,
    data: QuoteCreate,
    file: UploadFile = File(None),
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check_vve_access(vve_id, current_user, db)
    item = db.query(MJOPItem).filter(MJOPItem.id == data.mjop_item_id, MJOPItem.vve_id == vve_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="MJOP post niet gevonden")

    doc_path = None
    if file:
        upload_dir = os.path.join(settings.UPLOAD_DIR, "quotes", str(vve_id))
        os.makedirs(upload_dir, exist_ok=True)
        stored_name = f"{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        doc_path = os.path.join(upload_dir, stored_name)
        with open(doc_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

    quote = Quote(vve_id=vve_id, document_path=doc_path, **data.model_dump())
    db.add(quote)
    item.status = "quoted"
    db.commit()
    db.refresh(quote)
    return quote


@router.post("/quotes/{quote_id}/approve", response_model=QuoteOut)
def approve_quote(
    vve_id: int,
    quote_id: int,
    data: QuoteApprove,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check_vve_access(vve_id, current_user, db)
    quote = db.query(Quote).filter(Quote.id == quote_id, Quote.vve_id == vve_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Offerte niet gevonden")

    quote.is_approved = True
    quote.approved_at = datetime.now(timezone.utc)
    quote.approved_by_id = current_user.id
    if data.final_amount is not None:
        quote.final_amount = data.final_amount

    # Goedgekeurde offerte wordt de actual van de MJOP post
    item = db.query(MJOPItem).filter(MJOPItem.id == quote.mjop_item_id).first()
    if item:
        item.actual_amount = data.final_amount or quote.quoted_amount
        item.status = "approved"

    db.commit()
    db.refresh(quote)
    return quote


# --- Reservefonds ---

@router.get("/reservefonds", response_model=list[ReserveFondsEntryOut])
def list_reservefonds(vve_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_vve_access(vve_id, current_user, db)
    return db.query(ReserveFondsEntry).filter(ReserveFondsEntry.vve_id == vve_id).order_by(ReserveFondsEntry.entry_date).all()


@router.post("/reservefonds", response_model=ReserveFondsEntryOut, status_code=status.HTTP_201_CREATED)
def add_reservefonds_entry(
    vve_id: int,
    data: ReserveFondsEntryCreate,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check_vve_access(vve_id, current_user, db)
    entry = ReserveFondsEntry(vve_id=vve_id, **data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


# --- Bijdrageplan ---

@router.get("/contributions", response_model=list[ContributionPlanOut])
def list_contributions(vve_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_vve_access(vve_id, current_user, db)
    return db.query(ContributionPlan).filter(ContributionPlan.vve_id == vve_id).order_by(ContributionPlan.effective_from.desc()).all()


@router.post("/contributions", response_model=ContributionPlanOut, status_code=status.HTTP_201_CREATED)
def create_contribution_plan(
    vve_id: int,
    data: ContributionPlanCreate,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check_vve_access(vve_id, current_user, db)
    plan = ContributionPlan(vve_id=vve_id, **data.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


# --- Dashboard / Scenarios ---

@router.get("/dashboard")
def get_financial_dashboard(
    vve_id: int,
    inflatie: float = Query(default=0.0, ge=0.0, le=20.0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_vve_access(vve_id, current_user, db)
    from app.models.vve import VvE
    from app.models.appartement import Appartement as AppartementModel

    vve = db.query(VvE).filter(VvE.id == vve_id).first()
    if not vve:
        raise HTTPException(status_code=404, detail="VvE niet gevonden")

    # Huidig reservefonds saldo
    entries = db.query(ReserveFondsEntry).filter(ReserveFondsEntry.vve_id == vve_id).all()
    balance = sum(e.amount for e in entries) if entries else Decimal(0)

    # Actueel bijdrageplan
    today = date.today()
    plan = db.query(ContributionPlan).filter(
        ContributionPlan.vve_id == vve_id,
        ContributionPlan.effective_from <= today,
    ).order_by(ContributionPlan.effective_from.desc()).first()
    contribution = plan.amount_per_period if plan else Decimal(0)

    # MJOP items van actief upload
    active_upload = db.query(MJOPUpload).filter(
        MJOPUpload.vve_id == vve_id, MJOPUpload.status == "active"
    ).order_by(MJOPUpload.uploaded_at.desc()).first()

    mjop_items = []
    if active_upload:
        db_items = db.query(MJOPItem).filter(MJOPItem.mjop_upload_id == active_upload.id).all()
        mjop_items = [
            MJOPItemInput(
                id=i.id,
                planned_year=i.planned_year,
                planned_quarter=i.planned_quarter,
                planned_amount=i.planned_amount,
                description=i.description,
            )
            for i in db_items
        ]

    # Appartementen met aandeel
    appartementen = db.query(AppartementModel).filter(
        AppartementModel.vve_id == vve_id, AppartementModel.is_active == True
    ).order_by(AppartementModel.nummer, AppartementModel.naam).all()
    aandelen = [a.aandeel for a in appartementen]
    totaal_aandeel = sum(aandelen) if aandelen else Decimal(0)

    # Bijdrage per appartement
    share_denominator = vve.share_denominator or 1
    bijdrage_per_eenheid = (
        float(contribution / share_denominator)
        if share_denominator > 1 and contribution > 0
        else None
    )
    bijdrage_per_appartement = [
        {
            "id": a.id,
            "naam": a.naam,
            "nummer": a.nummer,
            "eigenaar_naam": a.eigenaar_naam,
            "aandeel": float(a.aandeel),
            "bijdrage_per_periode": float(
                a.aandeel / totaal_aandeel * contribution if totaal_aandeel > 0 else Decimal(0)
            ),
        }
        for a in appartementen
    ]

    inp = FinancialInput(
        current_balance=balance,
        contribution_per_period=contribution,
        contribution_frequency=vve.contribution_frequency,
        mjop_items=mjop_items,
        current_year=today.year,
        current_quarter=(today.month - 1) // 3 + 1,
        member_aandelen=aandelen,
        inflatie_percentage=Decimal(str(inflatie)),
    )

    result = calculate_all_scenarios(inp)
    result["share_denominator"] = share_denominator
    result["bijdrage_per_eenheid"] = bijdrage_per_eenheid
    result["bijdrage_per_appartement"] = bijdrage_per_appartement
    return result
