from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.db import get_db
from backend.schemas import RestaurantCreate, RestaurantOut

router = APIRouter(prefix="/api/restaurants", tags=["restaurants"])

COLUMNS = "id, name, category, price_range, location, memo, is_favorite, status, owner_id, created_at"
NOT_FOUND = "식당을 찾을 수 없습니다"


def _get_or_404(db: Session, restaurant_id: int) -> dict:
    row = db.execute(
        text(f"SELECT {COLUMNS} FROM restaurants WHERE id = :id"), {"id": restaurant_id}
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    return dict(row)


@router.get("", response_model=list[RestaurantOut])
def list_restaurants(
    category: Optional[str] = Query(default=None, max_length=20),
    price_range: Optional[int] = Query(default=None, ge=1, le=3),
    status: Optional[Literal["WANT", "VISITED"]] = None,
    q: Optional[str] = Query(default=None, max_length=100),
    db: Session = Depends(get_db),
):
    conditions = []
    params: dict = {}
    if category:
        conditions.append("category = :category")
        params["category"] = category
    if price_range is not None:
        conditions.append("price_range = :price_range")
        params["price_range"] = price_range
    if status:
        conditions.append("status = :status")
        params["status"] = status
    if q and q.strip():
        # 검색어 안의 % _ 는 글자 그대로 찾는다.
        escaped = q.strip().replace("|", "||").replace("%", "|%").replace("_", "|_")
        conditions.append("name LIKE :q ESCAPE '|'")
        params["q"] = f"%{escaped}%"

    where = f" WHERE {' AND '.join(conditions)}" if conditions else ""
    rows = db.execute(text(f"SELECT {COLUMNS} FROM restaurants{where} ORDER BY id DESC"), params).mappings().all()
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


@router.get("/{restaurant_id}", response_model=RestaurantOut)
def get_restaurant(restaurant_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, restaurant_id)


@router.put("/{restaurant_id}", response_model=RestaurantOut)
def update_restaurant(restaurant_id: int, body: RestaurantCreate, db: Session = Depends(get_db)):
    _get_or_404(db, restaurant_id)
    db.execute(
        text(
            "UPDATE restaurants SET name = :name, category = :category, price_range = :price_range, "
            "location = :location, memo = :memo WHERE id = :id"
        ),
        {**body.model_dump(), "id": restaurant_id},
    )
    db.commit()
    return _get_or_404(db, restaurant_id)


@router.delete("/{restaurant_id}", status_code=204)
def delete_restaurant(restaurant_id: int, db: Session = Depends(get_db)):
    _get_or_404(db, restaurant_id)
    db.execute(text("DELETE FROM restaurants WHERE id = :id"), {"id": restaurant_id})
    db.commit()
    return Response(status_code=204)
