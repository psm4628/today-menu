from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.db import get_db
from backend.schemas import RestaurantCreate, RestaurantOut

router = APIRouter(prefix="/api/restaurants", tags=["restaurants"])

COLUMNS = "id, name, category, price_range, location, memo, is_favorite, status, owner_id, created_at"


@router.get("", response_model=list[RestaurantOut])
def list_restaurants(db: Session = Depends(get_db)):
    rows = db.execute(text(f"SELECT {COLUMNS} FROM restaurants ORDER BY id DESC")).mappings().all()
    return [dict(r) for r in rows]


@router.post("", response_model=RestaurantOut, status_code=201)
def create_restaurant(body: RestaurantCreate, db: Session = Depends(get_db)):
    result = db.execute(
        text(
            "INSERT INTO restaurants (name, category, price_range, location, memo) "
            "VALUES (:name, :category, :price_range, :location, :memo)"
        ),
        body.model_dump(),
    )
    new_id = result.lastrowid
    row = db.execute(text(f"SELECT {COLUMNS} FROM restaurants WHERE id = :id"), {"id": new_id}).mappings().one()
    db.commit()
    return dict(row)
