"""Carga inicial de tiendas desde data/stores_seed.json hacia la base de datos.

Se ejecuta una sola vez (idempotente: si ya hay tiendas, no vuelve a insertar).
Al re-ejecutar con --force, actualiza grupo/orden/coordenadas SIN tocar el estado
de 'atendida' (para poder re-agrupar sin perder el avance ya capturado).
"""
import json
import sys
from pathlib import Path

from app.database import Base, SessionLocal, engine
from app.models import Store

SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "stores_seed.json"


def seed(force: bool = False):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = {s.det: s for s in db.query(Store).all()}
        with open(SEED_PATH, encoding="utf-8") as f:
            data = json.load(f)

        created, updated = 0, 0
        for row in data:
            det = row["det"]
            if det in existing:
                if force:
                    s = existing[det]
                    s.nombre = row["nombre"]
                    s.formato = row.get("formato")
                    s.estatus = row.get("estatus")
                    s.grupo_id = row["grupo_id"]
                    s.orden = row["orden"]
                    s.lat = row["lat"]
                    s.lon = row["lon"]
                    updated += 1
                continue
            db.add(Store(
                det=det,
                nombre=row["nombre"],
                formato=row.get("formato"),
                estatus=row.get("estatus"),
                grupo_id=row["grupo_id"],
                orden=row["orden"],
                lat=row["lat"],
                lon=row["lon"],
                atendida=False,
            ))
            created += 1
        db.commit()
        print(f"Seed listo. Nuevas: {created}, actualizadas: {updated}, total en BD: {db.query(Store).count()}")
    finally:
        db.close()


if __name__ == "__main__":
    seed(force="--force" in sys.argv)
