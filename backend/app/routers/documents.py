import os
import shutil
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.document import VvEDocument
from app.core.dependencies import get_current_user, get_current_beheerder, require_vve_access
from app.core.config import settings

router = APIRouter(prefix="/api/vves/{vve_id}/documents", tags=["documents"])


class DocumentOut(BaseModel):
    id: int
    vve_id: int
    title: str
    description: str | None
    original_filename: str
    category: str
    uploaded_by_id: int
    uploaded_at: datetime

    model_config = {"from_attributes": True}


def _check_vve_access(vve_id: int, user: User, db: Session):
    require_vve_access(vve_id, user, db)


@router.get("", response_model=list[DocumentOut])
def list_documents(
    vve_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_vve_access(vve_id, current_user, db)
    return (
        db.query(VvEDocument)
        .filter(VvEDocument.vve_id == vve_id)
        .order_by(VvEDocument.uploaded_at.desc())
        .all()
    )


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    vve_id: int,
    file: UploadFile = File(...),
    title: str = Query(...),
    category: str = Query(default="overig"),
    description: str | None = Query(default=None),
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check_vve_access(vve_id, current_user, db)

    upload_dir = os.path.join(settings.UPLOAD_DIR, "documents", str(vve_id))
    os.makedirs(upload_dir, exist_ok=True)
    stored_name = f"{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{file.filename}"
    file_path = os.path.join(upload_dir, stored_name)

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    doc = VvEDocument(
        vve_id=vve_id,
        title=title,
        description=description,
        original_filename=file.filename,
        stored_filename=stored_name,
        category=category,
        uploaded_by_id=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/{doc_id}/download")
def download_document(
    vve_id: int,
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_vve_access(vve_id, current_user, db)
    doc = db.query(VvEDocument).filter(
        VvEDocument.id == doc_id, VvEDocument.vve_id == vve_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document niet gevonden")

    file_path = os.path.join(settings.UPLOAD_DIR, "documents", str(vve_id), doc.stored_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Bestand niet gevonden op schijf")

    return FileResponse(file_path, filename=doc.original_filename, media_type="application/octet-stream")


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    vve_id: int,
    doc_id: int,
    current_user: User = Depends(get_current_beheerder),
    db: Session = Depends(get_db),
):
    _check_vve_access(vve_id, current_user, db)
    doc = db.query(VvEDocument).filter(
        VvEDocument.id == doc_id, VvEDocument.vve_id == vve_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document niet gevonden")

    file_path = os.path.join(settings.UPLOAD_DIR, "documents", str(vve_id), doc.stored_filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    db.delete(doc)
    db.commit()
