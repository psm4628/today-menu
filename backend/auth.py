import base64
import hashlib
import hmac
import logging
import os
import re
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.db import get_db

logger = logging.getLogger("uvicorn.error")
router = APIRouter(prefix="/api/auth", tags=["auth"])

SESSION_COOKIE = "today_menu_session"  # flow-task 의 session 쿠키(같은 주소·다른 포트)와 겹치지 않게 이름을 다르게 한다
SESSION_DAYS = 7
USERNAME_RE = re.compile(r"[A-Za-z0-9_]{3,30}")

SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1

MSG_TAKEN = "이미 사용 중인 아이디입니다"
MSG_BAD_LOGIN = "아이디 또는 비밀번호가 올바르지 않습니다"
MSG_UNAUTHORIZED = "로그인이 필요합니다"
DEFAULT_TAGS = ["혼밥 가능", "웨이팅 짧음", "가성비", "분위기 좋음"]  # 가입할 때 그 사용자 소유로 만든다
MSG_TOO_MANY = "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요"

# 로그인 시도 제한: 실패를 login_attempts 에 기록한다.
# 같은 아이디로 10분 안에 5회, 같은 IP 로 10분 안에 20회 실패하면 마지막 실패부터 10분 동안 429.
LOCK_WINDOW_MINUTES = 10
MAX_FAILS_PER_USERNAME = 5
MAX_FAILS_PER_IP = 20


# ---- 비밀번호 해시 (표준 라이브러리 scrypt, 솔트 포함) ----

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P)
    return "scrypt${}${}${}${}${}".format(
        SCRYPT_N, SCRYPT_R, SCRYPT_P,
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        scheme, n, r, p, salt_b64, digest_b64 = stored_hash.split("$")
        if scheme != "scrypt":
            return False
        expected = base64.b64decode(digest_b64)
        actual = hashlib.scrypt(
            password.encode("utf-8"), salt=base64.b64decode(salt_b64), n=int(n), r=int(r), p=int(p)
        )
    except ValueError:
        return False
    return hmac.compare_digest(actual, expected)


# 없는 아이디로 로그인해도 해시 계산 시간이 같도록 쓰는 더미 해시
DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(16))


def client_ip(request: Request) -> str:
    # Nginx 가 X-Real-IP 를 실제 접속 주소로 덮어쓴다(App 은 127.0.0.1 에서만 열려 있다). 없으면 접속 주소를 쓴다.
    ip = request.headers.get("x-real-ip") or (request.client.host if request.client else "unknown")
    return ip.strip()[:45]


def lock_remaining_seconds(db: Session, column: str, value: str, limit: int) -> int:
    """column(username 또는 ip)의 최근 실패가 한도 이상이면 잠금이 풀릴 때까지 남은 초, 아니면 0.
    마지막 실패 시각을 기준으로 10분 안의 실패 횟수를 센다."""
    row = db.execute(
        text(
            f"SELECT COUNT(*) AS c, "
            f"TIMESTAMPDIFF(SECOND, NOW(), MAX(attempted_at) + INTERVAL {LOCK_WINDOW_MINUTES} MINUTE) AS remain "
            f"FROM login_attempts WHERE {column} = :v AND attempted_at > "
            f"(SELECT MAX(attempted_at) FROM login_attempts WHERE {column} = :v) - INTERVAL {LOCK_WINDOW_MINUTES} MINUTE"
        ),
        {"v": value},
    ).mappings().one()
    if row["c"] >= limit and row["remain"] is not None and row["remain"] > 0:
        return int(row["remain"])
    return 0


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# ---- 입력·출력 모델 ----

class RegisterIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def valid_username(cls, v: str) -> str:
        if not USERNAME_RE.fullmatch(v):
            raise ValueError("아이디는 영문·숫자·밑줄(_) 3~30자로 입력해 주세요")
        return v.lower()  # 대소문자만 다른 아이디가 중복되지 않게 소문자로 저장

    @field_validator("password")
    @classmethod
    def valid_password(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("비밀번호를 입력해 주세요")
        if not 8 <= len(v) <= 128:
            raise ValueError("비밀번호는 8~128자로 입력해 주세요")
        return v


class LoginIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def valid_username(cls, v: str) -> str:
        if not 1 <= len(v) <= 30:
            raise ValueError("아이디를 입력해 주세요")
        return v.lower()

    @field_validator("password")
    @classmethod
    def valid_password(cls, v: str) -> str:
        if not 1 <= len(v) <= 128:
            raise ValueError("비밀번호를 입력해 주세요")
        return v


class UserOut(BaseModel):
    id: int
    username: str
    created_at: datetime


async def auth_validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """인증 요청의 422 응답에는 입력값(비밀번호 등)을 되돌려 주지 않는다. 다른 경로는 기존 형식 그대로."""
    if not request.url.path.startswith("/api/auth"):
        return await request_validation_exception_handler(request, exc)
    detail = [{"type": e["type"], "loc": e["loc"], "msg": e["msg"]} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": detail})


# ---- 현재 사용자 확인 (T40 이후 다른 라우터가 사용) ----

def is_https(request: Request) -> bool:
    return request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"


def get_current_user(request: Request, db: Session = Depends(get_db)) -> dict:
    """세션 쿠키로 로그인한 사용자(id, username, created_at)를 찾는다. 없거나 만료되면 401."""
    unauthorized = HTTPException(status_code=401, detail=MSG_UNAUTHORIZED)
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise unauthorized
    token_hash = hash_token(token)
    row = db.execute(
        text(
            "SELECT u.id, u.username, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id "
            "WHERE s.token_hash = :h AND s.expires_at > NOW()"
        ),
        {"h": token_hash},
    ).mappings().first()
    if row is None:
        # 만료된 세션은 사용할 때 지운다.
        db.execute(text("DELETE FROM sessions WHERE token_hash = :h AND expires_at <= NOW()"), {"h": token_hash})
        db.commit()
        raise unauthorized
    return dict(row)


def reject_owner_param(request: Request) -> None:
    """소유자는 서버가 로그인 사용자로 정한다. 쿼리로 owner_id 를 보내면 422."""
    if "owner_id" in request.query_params:
        raise HTTPException(status_code=422, detail="owner_id는 지정할 수 없습니다")


# ---- 엔드포인트 ----

@router.post("/register", response_model=UserOut, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    taken = HTTPException(status_code=409, detail=MSG_TAKEN)
    if db.execute(text("SELECT id FROM users WHERE username = :u"), {"u": body.username}).first():
        raise taken
    try:
        result = db.execute(
            text("INSERT INTO users (username, password_hash) VALUES (:u, :h)"),
            {"u": body.username, "h": hash_password(body.password)},
        )
        row = db.execute(
            text("SELECT id, username, created_at FROM users WHERE id = :id"), {"id": result.lastrowid}
        ).mappings().one()
        # 기본 태그 4개를 그 사용자 소유로 만든다(가입과 같은 트랜잭션).
        for tag_name in DEFAULT_TAGS:
            try:
                with db.begin_nested():
                    db.execute(
                        text("INSERT INTO tags (name, owner_id) VALUES (:name, :owner)"),
                        {"name": tag_name, "owner": result.lastrowid},
                    )
            except IntegrityError:
                # tags 의 이름 중복 규칙이 아직 (name) 전체 유일이면(T39 SQL 실행 전) 이미 있는 이름은 건너뛴다.
                logger.warning("기본 태그 '%s'를 만들지 못해 건너뜀(이름 중복 규칙 확인 필요)", tag_name)
        db.commit()
    except IntegrityError:  # 동시에 같은 아이디로 가입한 경우
        db.rollback()
        raise taken
    return dict(row)


@router.post("/login", response_model=UserOut)
def login(request: Request, body: LoginIn, response: Response, db: Session = Depends(get_db)):
    ip = client_ip(request)
    # 잠겨 있으면 비밀번호를 맞게 입력해도 429 (아이디가 있는지와 상관없이 같은 응답). 429 요청은 실패로 기록하지 않는다.
    remain = max(
        lock_remaining_seconds(db, "username", body.username, MAX_FAILS_PER_USERNAME),
        lock_remaining_seconds(db, "ip", ip, MAX_FAILS_PER_IP),
    )
    if remain > 0:
        raise HTTPException(status_code=429, detail=MSG_TOO_MANY, headers={"Retry-After": str(remain)})

    user = db.execute(
        text("SELECT id, username, password_hash, created_at FROM users WHERE username = :u"),
        {"u": body.username},
    ).mappings().first()
    # 아이디가 없어도 해시 검증을 해서 응답 시간 차이를 줄인다.
    password_ok = verify_password(body.password, user["password_hash"] if user else DUMMY_PASSWORD_HASH)
    if user is None or not password_ok:
        # 없는 아이디도 똑같이 기록한다. 하루 지난 기록은 함께 정리한다.
        db.execute(text("INSERT INTO login_attempts (username, ip) VALUES (:u, :ip)"), {"u": body.username, "ip": ip})
        db.execute(text("DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL 1 DAY"))
        db.commit()
        raise HTTPException(status_code=401, detail=MSG_BAD_LOGIN)

    # 성공하면 이 아이디의 실패 기록을 지운다.
    db.execute(text("DELETE FROM login_attempts WHERE username = :u"), {"u": body.username})
    # 로그인할 때마다 새 토큰을 발급하고, 이 사용자의 만료된 세션은 정리한다.
    db.execute(text("DELETE FROM sessions WHERE user_id = :id AND expires_at <= NOW()"), {"id": user["id"]})
    token = secrets.token_urlsafe(32)
    db.execute(
        text(
            "INSERT INTO sessions (token_hash, user_id, expires_at) "
            f"VALUES (:h, :id, NOW() + INTERVAL {SESSION_DAYS} DAY)"
        ),
        {"h": hash_token(token), "id": user["id"]},
    )
    db.commit()

    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_DAYS * 24 * 3600,
        httponly=True,
        samesite="lax",
        secure=is_https(request),
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return {"id": user["id"], "username": user["username"], "created_at": user["created_at"]}


@router.post("/logout", status_code=204)
def logout(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        db.execute(text("DELETE FROM sessions WHERE token_hash = :h"), {"h": hash_token(token)})
        db.commit()
    response = Response(status_code=204)  # 세션이 없어도 204
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="lax")
    return response


@router.get("/me", response_model=UserOut)
def me(response: Response, user: dict = Depends(get_current_user)):
    response.headers["Cache-Control"] = "no-store"
    return user
