"""Autenticacion simple: nombre + PIN compartido, guardado en la sesion (cookie firmada).

No es un sistema de auth robusto (no hay passwords individuales), pero es suficiente
para un equipo cerrado de ~6 personas externas que necesitan marcar avance.
"""
import os

from fastapi import Request
from fastapi.responses import RedirectResponse

APP_PIN = os.environ.get("APP_PIN", "2026")
SESSION_KEY = "user_name"


def is_logged_in(request: Request) -> bool:
    return bool(request.session.get(SESSION_KEY))


def current_user(request: Request) -> str | None:
    return request.session.get(SESSION_KEY)


def login_user(request: Request, name: str) -> None:
    request.session[SESSION_KEY] = name.strip()


def logout_user(request: Request) -> None:
    request.session.pop(SESSION_KEY, None)


def require_login(request: Request):
    """Dependency-style guard: devuelve un RedirectResponse si no hay sesion, o None si OK."""
    if not is_logged_in(request):
        return RedirectResponse(url="/login", status_code=303)
    return None
