# Rutas de Atencion - Recicladoras Bloque 2 y 3

App web responsiva (PWA) para coordinar y dar seguimiento a las rutas de
atencion de las 91 tiendas agrupadas en `Recicladoras Bloque 2 y 3.xlsx`.

- Login simple: nombre + PIN compartido (pensado para un equipo cerrado, ej. 6 personas).
- Mapa interactivo (Leaflet) con filtro por grupo, ruta sugerida y checklist de atencion.
- Progreso persistido en base de datos (no en el navegador) -> se sincroniza entre
  todas las personas que usen la app, desde celular o computadora.
- Instalable como app en la pantalla de inicio de Android (PWA, sin pasar por Play Store).

## Correr en local

```bash
uv venv
uv pip install -r requirements.txt --index-url https://pypi.ci.artifacts.walmart.com/artifactory/api/pypi/external-pypi/simple --allow-insecure-host pypi.ci.artifacts.walmart.com
.venv\Scripts\uvicorn.exe app.main:app --reload --port 8899
```

Abre http://127.0.0.1:8899/login — usuario cualquiera, PIN por default `2026`
(cambialo con la variable de entorno `APP_PIN`).

## Desplegar en Render.com (acceso publico, sin VPN de Walmart)

Como la app la van a usar 6 personas externas a Walmart, no puede vivir en la
red interna (AI Innovation Lab exige VPN). Por eso usamos un hosting publico
gratuito: **Render.com** para la app + **Neon.tech** para la base de datos
(Postgres gratis, persistente, no se borra al reiniciar el servicio).

### Paso 1 - Base de datos (Neon, gratis)

1. Entra a https://neon.tech y crea una cuenta gratis (con tu correo personal
   o Gmail, no hace falta correo de Walmart).
2. Crea un proyecto nuevo, cualquier nombre (ej. "recicladoras").
3. En el dashboard copia el **Connection string** (empieza con `postgresql://...`).
   Guardalo, lo vas a necesitar en el paso 3.

### Paso 2 - Subir el codigo a GitHub

1. Crea un repo nuevo en https://github.com (puede ser privado), ej. `recicladoras-app`.
2. Desde esta carpeta (`recicladoras_app`):

   ```bash
   git init
   git add .
   git commit -m "App de rutas de atencion - Recicladoras"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/recicladoras-app.git
   git push -u origin main
   ```

### Paso 3 - Crear el servicio en Render

1. Entra a https://render.com y crea una cuenta gratis (puedes usar tu cuenta de GitHub).
2. "New +" -> "Web Service" -> conecta tu repo `recicladoras-app`.
3. Render va a detectar el `render.yaml` automaticamente (Blueprint). Si no,
   configura manualmente:
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. En "Environment", agrega las variables:
   - `DATABASE_URL` = el connection string de Neon (paso 1)
   - `APP_PIN` = el PIN que le vas a compartir a las 6 personas (ej. `4589`)
   - `SECRET_KEY` = cualquier texto largo y aleatorio (Render puede generarlo solo)
5. Deploy. Render te da una URL publica tipo
   `https://rutas-atencion-recicladoras.onrender.com` — esa es la que
   compartes con las 6 personas.

### Notas honestas

- El plan gratis de Render "duerme" el servicio si nadie lo usa por 15 minutos;
  la primera carga del dia puede tardar ~30-50 segundos en despertar. Si eso
  molesta, se puede subir a un plan pago (~$7 USD/mes) para que este siempre activo.
- El PIN compartido NO es un sistema de seguridad fuerte — es solo para evitar
  que entre gente por error. No subas informacion sensible (ninguna
  columna del Excel actual lo es: son nombres de tienda, formato y coordenadas).
- Si en algun momento quieren re-agrupar las tiendas (nuevas altas/bajas),
  corre de nuevo el script de agrupacion, exporta un nuevo `stores_seed.json`
  y ejecuta `python -m app.seed --force` (actualiza grupos/coordenadas sin
  borrar el avance ya capturado).

## Estructura

```
app/
  main.py       - rutas FastAPI (paginas + API)
  models.py     - tablas SQLAlchemy (Store, AttendanceLog)
  database.py   - conexion (SQLite local / Postgres en produccion via DATABASE_URL)
  auth.py       - login simple nombre + PIN (sesion por cookie firmada)
  seed.py       - carga inicial de tiendas desde data/stores_seed.json
templates/      - login.html, index.html
static/         - app.js (logica del mapa/checklist), manifest.json (PWA), icons/
data/
  stores_seed.json - datos exportados de agrupar_tiendas_bloque23.py
```
