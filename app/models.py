from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Store(Base):
    __tablename__ = "stores"

    det: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(200))
    formato: Mapped[str] = mapped_column(String(50), nullable=True)
    estatus: Mapped[str] = mapped_column(String(50), nullable=True)
    grupo_id: Mapped[int] = mapped_column(Integer, index=True)
    orden: Mapped[int] = mapped_column(Integer)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)

    atendida: Mapped[bool] = mapped_column(Boolean, default=False)
    atendida_por: Mapped[str] = mapped_column(String(100), nullable=True)
    atendida_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    def to_dict(self):
        return {
            "det": self.det,
            "nombre": self.nombre,
            "formato": self.formato,
            "estatus": self.estatus,
            "grupo_id": self.grupo_id,
            "orden": self.orden,
            "lat": self.lat,
            "lon": self.lon,
            "atendida": self.atendida,
            "atendida_por": self.atendida_por,
            "atendida_en": self.atendida_en.isoformat() if self.atendida_en else None,
        }


class AttendanceLog(Base):
    """Bitacora simple: quien marco que tienda, cuando, y en que sentido."""
    __tablename__ = "attendance_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    det: Mapped[int] = mapped_column(Integer, index=True)
    usuario: Mapped[str] = mapped_column(String(100))
    accion: Mapped[str] = mapped_column(String(20))  # "atendida" | "pendiente"
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
