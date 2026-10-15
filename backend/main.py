from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import InterfaceError, OperationalError

from backend import auth
from backend.db import DBConfigError
from backend.routers import recommend, restaurants, tags, visits

app = FastAPI(title="오늘 뭐 먹지?")
app.include_router(auth.router)
app.include_router(restaurants.router)
app.include_router(recommend.router)
app.include_router(tags.router)
app.include_router(visits.router)


app.add_exception_handler(RequestValidationError, auth.auth_validation_error_handler)


@app.exception_handler(OperationalError)
@app.exception_handler(InterfaceError)
@app.exception_handler(DBConfigError)
async def db_unavailable(request: Request, exc: Exception):
    # 내부 오류 내용은 응답에 넣지 않는다.
    return JSONResponse(status_code=503, content={"detail": "DB에 연결할 수 없습니다"})


@app.get("/api/health")
def health():
    return {"status": "ok"}
