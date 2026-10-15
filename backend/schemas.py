import re
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, field_validator


class RestaurantCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")  # owner_id 등 알 수 없는 필드는 422 (소유자는 서버가 정한다)

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


class FavoriteIn(BaseModel):
    is_favorite: StrictBool  # true/false 만 받는다 ("true", 1 등은 422)


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


class VisitCreate(BaseModel):
    visited_at: date
    rating: StrictInt = Field(ge=1, le=5)  # 정수만 (문자열 "3", 3.5, true 는 422)
    comment: Optional[str] = None

    @field_validator("visited_at", mode="before")
    @classmethod
    def date_format(cls, v):
        # YYYY-MM-DD 문자열만 받는다 (숫자·다른 형식은 거절)
        if not isinstance(v, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
            raise ValueError("방문일은 YYYY-MM-DD 형식으로 입력해 주세요")
        try:
            return date.fromisoformat(v)
        except ValueError:
            raise ValueError("올바른 날짜를 입력해 주세요")

    @field_validator("visited_at")
    @classmethod
    def not_future(cls, v: date) -> date:
        if v > date.today():  # 서버 기준 오늘
            raise ValueError("미래 날짜는 입력할 수 없습니다")
        return v

    @field_validator("comment")
    @classmethod
    def clean_comment(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if len(v) > 300:
            raise ValueError("후기는 300자 이하로 입력해 주세요")
        return v or None


class VisitOut(BaseModel):
    id: int
    restaurant_id: int
    visited_at: date
    rating: int
    comment: Optional[str] = None
