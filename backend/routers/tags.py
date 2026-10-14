from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.db import get_db
from backend.schemas import TagCreate, TagOut

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("", response_model=list[TagOut])
def list_tags(db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT id, name FROM tags ORDER BY name, id")).mappings().all()
    return [dict(r) for r in rows]


@router.post("", response_model=TagOut, status_code=201)
def create_tag(body: TagCreate, db: Session = Depends(get_db)):
    try:
        result = db.execute(text("INSERT INTO tags (name) VALUES (:name)"), {"name": body.name})
        db.commit()
    except IntegrityError:
        # name 은 UNIQUE 이므로 이미 있는 이름이면 여기로 온다.
        db.rollback()
        raise HTTPException(status_code=409, detail="이미 있는 태그입니다")
    return {"id": result.lastrowid, "name": body.name}
