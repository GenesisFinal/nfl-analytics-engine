# NFL Analytics Engine

Motor cuantitativo de valoración actuarial de jugadores de la NFL (0-100), auditoría de minutos basura (*Garbage Time*), monitoreo en vivo de probabilidad de victoria (*Win Probability*) vía ESPN JSON API y crónicas analíticas generadas con `nflverse` + `google-genai` (`gemini-3.8-flash`).

## Arquitectura e Invariantes

1. **Cero Web Scraping HTML y Cero CORS en Cliente**:
   - Toda la ingesta se ejecuta en Python (`src/ingest_espn.py` y `src/ingest_nflverse.py`) y se publica como JSON estático en `public/data/`.
   - El frontend (`public/index.html` + `public/app.js`) consume únicamente los JSON estáticos locales servidos por GitHub Pages.
2. **Filtro de Minutos Basura (*Garbage Time*)**:
   - Se excluye para el cálculo de eficiencia toda jugada del 4to cuarto (`qtr == 4`) donde la probabilidad de victoria previa (`wp`) sea `< 0.05` (5%) o `> 0.95` (95%).
   - Se conserva la producción bruta para exponer el **Índice de Inflación Estadística**.
3. **Score de Impacto Posicional (Escala 0 a 100)**:
   - **Quarterbacks (QB)** (mín. 15 dropbacks/semana): `0.45 * z(EPA_per_dropback) + 0.25 * z(WPA_total) + 0.20 * z(CPOE) + 0.10 * z(Success_Rate)`
   - **Running Backs (RB)** (mín. 10 acarreos+targets/semana): `0.50 * z(EPA_per_rush_and_rec) + 0.25 * z(Success_Rate) + 0.25 * z(WPA_total)`
   - **Receptores (WR / TE)** (mín. 5 targets/semana): `0.45 * z(EPA_per_target) + 0.30 * z(WPA_total) + 0.25 * z(YAC_EPA)`
4. **Momentos Críticos en Vivo**:
   - Extracción de las 3 jugadas bisagra con mayor variación absoluta en probabilidad de victoria (`|delta_wp| >= 0.12`) desde el arreglo `winprobability` de ESPN `/summary`.

## Ejecución Local

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt

# Ejecutar suite de pruebas
.venv/Scripts/pytest tests/ -v

# Ejecutar pipeline completo de datos reales
.venv/Scripts/python -m src.ingest_espn
.venv/Scripts/python -m src.valuation_model
.venv/Scripts/python -m src.critic_generator
```
