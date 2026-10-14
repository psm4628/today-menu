from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class RestaurantCreate(BaseModel):
    name: str = Field(max_length=100)
    category: Optional[str] = Field(default=None, max_length=20)
    price_range: Optional[int] = Field(default=None, ge=1, le=3)
    location: Optional[str] = Field(default=None, max_length=200)
    memo: Optional[str] = Field(default=None, max_length=5000)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("이름을 입력해 주세요")
        return v

    @field_validator("category", "location", "memo")
    @classmethod
    def blank_to_none(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        return v or None


class TagCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("태그 이름을 입력해 주세요")
        if len(v) > 30:
            raise ValueError("태그 이름은 30자 이하로 입력해 주세요")
        return v


class TagOut(BaseModel):
    id: int
    name: str


class RestaurantTagsIn(BaseModel):
    tag_ids: list[int]


class RestaurantOut(BaseModel):
    id: int
    name: str
    category: Optional[str] = None
    price_range: Optional[int] = None
    location: Optional[str] = None
    memo: Optional[str] = None
    is_favorite: bool
    status: str
    owner_id: int
    created_at: Optional[datetime] = None
    tags: list[TagOut] = []
