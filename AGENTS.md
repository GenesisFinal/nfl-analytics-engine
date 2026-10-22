# Reglas de Arquitectura e Invariantes del Proyecto: NFL Analytics Engine

## 1. Objetivo del Sistema
Construir una plataforma web pública, 100% automatizada y sin costo de servidores ni licencias de datos, enfocada exclusivamente en análisis profundo de la NFL. El sistema combina marcadores y probabilidad de victoria en vivo (vía ESPN JSON API) con valoración matemática objetiva de jugadores y crónicas críticas generadas por IA (vía nflverse + Gemini API), desplegado en GitHub Pages y actualizado mediante GitHub Actions.

## 2. Restricciones Estrictas de Fuentes de Datos (PROHIBIDO hacer Web Scraping HTML)
- NUNCA uses BeautifulSoup, Selenium ni Playwright para extraer tablas de sitios protegidos por Cloudflare (como Pro-Football-Reference o FBref).
- NUNCA llames a la API de ESPN directamente desde el navegador del usuario (`app.js`) para evitar bloqueos CORS o errores HTTP 403 por límite de peticiones. Toda consulta debe ocurrir en los scripts de Python en `src/` y guardarse como JSON estático en `public/data/`.
- Fuentes autorizadas:
  1. Play-by-Play (Parquet): `https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{SEASON}.parquet` (Si el archivo de la temporada en curso devuelve HTTP 404 por calendario de pretemporada, el script debe hacer fallback automático a la última temporada disponible, ej. 2025, y dejarlo registrado en el JSON de metadatos).
  2. Rosters (Parquet): `https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_{SEASON}.parquet`
  3. Marcador en vivo: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard` (con fallback automático a `https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`).
  4. Resumen y Win Probability: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={EVENT_ID}`

## 3. Modelo Matemático de Valoración Objetiva (`src/valuation_model.py`)
Para evitar que jugadores acumulen estadísticas vacías en partidos ya definidos ("minutos basura"), debes aplicar los siguientes filtros sobre el dataset de `nflverse`:
- **Filtro de Minutos Basura (Garbage Time):** Excluir para el cálculo del ranking de eficiencia cualquier jugada del 4to cuarto (`qtr == 4`) donde la probabilidad de victoria antes de la jugada (`wp`) sea menor a 0.05 (5%) o mayor a 0.95 (95%). Conservar las estadísticas brutas en una columna separada para exponer la diferencia ("Índice de Inflación Estadística").
- **Mínimo de participación:** Mínimo de 15 dropbacks por semana para QBs, 10 acarreos/targets para RBs y 5 targets para WRs/TEs.
- **Fórmula del Score de Impacto (Escala 0 a 100 mediante percentil empírico o Z-score normalizado por posición):**
  - **Quarterbacks (QB):** `0.45 * z(EPA_per_dropback) + 0.25 * z(WPA_total) + 0.20 * z(CPOE) + 0.10 * z(Success_Rate)`
  - **Running Backs (RB):** `0.50 * z(EPA_per_rush_and_rec) + 0.25 * z(Success_Rate) + 0.25 * z(WPA_total)`
  - **Receptores (WR / TE):** `0.45 * z(EPA_per_target) + 0.30 * z(WPA_total) + 0.25 * z(YAC_EPA)`
- **Momentos Críticos en Vivo (`src/ingest_espn.py`):** Analizar el arreglo `winprobability` del endpoint `/summary` de ESPN y extraer las 3 jugadas con mayor variación absoluta (`|delta_wp| >= 0.12`) de cada partido.

## 4. Reglas de Generación de Críticas Textuales (`src/critic_generator.py`)
- Usar el SDK oficial `google-genai` leyendo la clave desde la variable de entorno `GEMINI_API_KEY`. Si la variable no está definida en un entorno de prueba local, generar un análisis determinista basado en plantillas a partir de los mismos datos para que el pipeline nunca falle.
- Reglas de estilo obligatorias en el prompt del sistema de la crítica:
  - Prohibido usar el guion largo, usar siempre guion simple (-).
  - Cero adjetivos vacíos. Cada afirmación debe citar el dato exacto de EPA, WPA, CPOE o variación de probabilidad de victoria.
  - Señalar explícitamente al "MVP Real" (mayor EPA/WPA sin minutos basura) y al "Estadístico Inflado" (mayor brecha entre yardas brutas y EPA en tiempo competitivo).

## 5. Estándares de Frontend (`public/`) y Verificación
- Frontend construido en HTML5 limpio, Tailwind CSS (vía CDN) y JavaScript nativo modular. Sin frameworks pesados de compilación que compliquen el despliegue estático.
- Estética de tablero ejecutivo oscuro (alto contraste, tablas ordenables, filtro por posición QB/RB/WR/TE, tarjetas de partidos en vivo con indicador de jugada crítica y sección de crónicas analíticas).
- Todo cambio de código en `src/` debe ser validado ejecutando `pytest tests/` antes de darse por completado.