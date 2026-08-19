import os
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from starlette.middleware.sessions import SessionMiddleware

from app import auth
from app.database import Base, SessionLocal, engine, get_db
from app.models import AttendanceLog, Store
from app.seed import seed

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-cambiar-en-produccion")

app = FastAPI(title="Rutas de Atencion - Recicladoras")
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY, same_site="lax")
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    # Seed automatico solo si la tabla esta vacia (primer arranque en un ambiente nuevo).
    db = SessionLocal()
    try:
        if db.query(Store).count() == 0:
            seed()
    finally:
        db.close()


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


# ---------------- Auth ----------------

@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request, error: str | None = None):
    if auth.is_logged_in(request):
        return RedirectResponse(url="/", status_code=303)
    return templates.TemplateResponse("login.html", {"request": request, "error": error})


@app.post("/login")
def login_submit(request: Request, nombre: str = Form(...), pin: str = Form(...)):
    nombre = nombre.strip()
    if not nombre:
        return RedirectResponse(url="/login?error=Escribe+tu+nombre", status_code=303)
    if pin.strip() != auth.APP_PIN:
        return RedirectResponse(url="/login?error=PIN+incorrecto", status_code=303)
    auth.login_user(request, nombre)
    return RedirectResponse(url="/", status_code=303)


@app.post("/logout")
def logout(request: Request):
    auth.logout_user(request)
    return RedirectResponse(url="/login", status_code=303)


# ---------------- App principal ----------------

@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    guard = auth.require_login(request)
    if guard:
        return guard
    return templates.TemplateResponse("index.html", {
        "request": request,
        "user_name": auth.current_user(request),
    })


# ---------------- API ----------------

@app.get("/api/stores")
def api_list_stores(request: Request, db: Session = Depends(get_db)):
    guard = auth.require_login(request)
    if guard:
        raise HTTPException(status_code=401, detail="No autenticado")
    stores = db.query(Store).order_by(Store.grupo_id, Store.orden).all()
    return [s.to_dict() for s in stores]


@app.post("/api/stores/{det}/toggle")
def api_toggle_store(det: int, request: Request, db: Session = Depends(get_db)):
    guard = auth.require_login(request)
    if guard:
        raise HTTPException(status_code=401, detail="No autenticado")
    user = auth.current_user(request)

    store = db.query(Store).filter(Store.det == det).first()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    store.atendida = not store.atendida
    if store.atendida:
        store.atendida_por = user
        store.atendida_en = datetime.now(timezone.utc)
        accion = "atendida"
    else:
        store.atendida_por = None
        store.atendida_en = None
        accion = "pendiente"

    db.add(AttendanceLog(det=det, usuario=user, accion=accion))
    db.commit()
    db.refresh(store)
    return store.to_dict()


@app.post("/api/groups/{grupo_id}/mark_all")
def api_mark_all(grupo_id: int, request: Request, valor: bool = True, db: Session = Depends(get_db)):
    guard = auth.require_login(request)
    if guard:
        raise HTTPException(status_code=401, detail="No autenticado")
    user = auth.current_user(request)

    stores = db.query(Store).filter(Store.grupo_id == grupo_id).all()
    if not stores:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")

    now = datetime.now(timezone.utc)
    for store in stores:
        store.atendida = valor
        store.atendida_por = user if valor else None
        store.atendida_en = now if valor else None
        db.add(AttendanceLog(det=store.det, usuario=user, accion="atendida" if valor else "pendiente"))
    db.commit()
    return [s.to_dict() for s in stores]
