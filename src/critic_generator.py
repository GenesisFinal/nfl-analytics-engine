"""Generador de Crónicas Analíticas y Auditoría Estadística NFL (vía Gemini API + Fallback Determinista).

Reglas de estilo y arquitectura:
1. Usa el SDK oficial `google-genai` (`from google import genai`) con el modelo `gemini-3.8-flash`
   leyendo `GEMINI_API_KEY` desde variables de entorno.
2. Si `GEMINI_API_KEY` no está definida o la API falla, ejecuta un motor determinista basado
   en plantillas cuantitativas para garantizar disponibilidad 100% en pruebas y CI/CD.
3. Prohibido el uso de guion largo o medio; `sanitize_text()` reemplaza cualquier ocurrencia
   por guion simple (`-`).
4. Cero adjetivos vacíos: cada afirmación cita valores exactos de EPA, WPA, CPOE o delta_wp.
5. Señala explícitamente al "MVP Real" y al "Estadístico Inflado".
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
from typing import Any

from google import genai

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_RANKINGS_PATH = PROJECT_ROOT / "public" / "data" / "player_rankings.json"
DEFAULT_SCOREBOARD_PATH = PROJECT_ROOT / "public" / "data" / "live_scoreboard.json"
DEFAULT_OUTPUT_PATH = PROJECT_ROOT / "public" / "data" / "game_critiques.json"

MODEL_NAME = "gemini-3.8-flash"

SYSTEM_PROMPT = (
    "Eres un auditor actuarial y analista cuantitativo de la NFL. "
    "REGLAS OBLIGATORIAS E INQUEBRANTABLES:\n"
    "1. Prohibido usar el guion largo o medio; usa SIEMPRE guion simple (-).\n"
    "2. Cero adjetivos vacios o subjetivos. Cada afirmacion debe citar el dato exacto "
    "de EPA, WPA, CPOE o variacion de probabilidad de victoria (delta_wp).\n"
    "3. Senala explicitamente al 'MVP Real' (mayor EPA/WPA sin minutos basura) y al "
    "'Estadistico Inflado' (mayor brecha entre yardas brutas y EPA en tiempo competitivo).\n"
    "4. Redacta en espanol tecnico, conciso y basado estrictamente en evidencia numerica."
)


def sanitize_text(text: str) -> str:
    """Reemplaza cualquier guion largo o medio por guion simple (`-`)."""
    if not isinstance(text, str):
        return str(text)
    return (
        text.replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u2015", "-")
        .replace("\u2212", "-")
    )


def _sanitize_payload(obj: Any) -> Any:
    """Aplica `sanitize_text` recursivamente sobre todas las cadenas de un objeto JSON."""
    if isinstance(obj, str):
        return sanitize_text(obj)
    if isinstance(obj, list):
        return [_sanitize_payload(item) for item in obj]
    if isinstance(obj, dict):
        return {k: _sanitize_payload(v) for k, v in obj.items()}
    return obj


def _build_deterministic_summary(
    mvp: dict[str, Any],
    inflated: dict[str, Any],
    season: int,
) -> str:
    """Construye el resumen ejecutivo determinista citando MVP Real, Estadístico Inflado y métricas."""
    mvp_name = mvp.get("player_name", "N/A")
    mvp_pos = mvp.get("position", "QB")
    mvp_team = mvp.get("team", "NFL")
    mvp_impact = float(mvp.get("impact_score", 0.0))
    mvp_epa = float(mvp.get("epa_total", 0.0))
    mvp_epa_play = float(mvp.get("epa_per_play", 0.0))
    mvp_wpa = float(mvp.get("wpa_total", 0.0))
    mvp_cpoe = float(mvp.get("cpoe", 0.0))
    mvp_sr = float(mvp.get("success_rate", 0.0)) * 100.0

    inf_name = inflated.get("player_name", "N/A")
    inf_pos = inflated.get("position", "QB")
    inf_team = inflated.get("team", "NFL")
    inf_raw_yards = float(inflated.get("raw_yards", 0.0))
    inf_comp_yards = float(inflated.get("competitive_yards", 0.0))
    inf_gt_yards = float(inflated.get("garbage_time_yards", 0.0))
    inf_epa = float(inflated.get("epa_total", 0.0))
    inf_raw_epa = float(inflated.get("raw_epa_total", 0.0))
    inf_wpa = float(inflated.get("wpa_total", 0.0))
    inf_cpoe = float(inflated.get("cpoe", 0.0))
    inf_index = float(inflated.get("inflation_index", 0.0))

    summary = (
        f"Auditoria cuantitativa temporada {season} (excluyendo jugadas de 4to cuarto con WP < 5% o WP > 95%): "
        f"El MVP Real es {mvp_name} ({mvp_pos} - {mvp_team}) con Impact Score de {mvp_impact:.1f}/100, "
        f"EPA competitivo total de {mvp_epa:+.2f} ({mvp_epa_play:+.3f} EPA/jugada), "
        f"WPA acumulado de {mvp_wpa:+.3f}, CPOE de {mvp_cpoe:+.2f}% y Success Rate de {mvp_sr:.1f}%. "
        f"En contraste, el Estadistico Inflado es {inf_name} ({inf_pos} - {inf_team}), quien registra "
        f"{inf_raw_yards:.0f} yardas brutas pero solo {inf_comp_yards:.0f} yardas en tiempo competitivo "
        f"({inf_gt_yards:.0f} yardas en minutos basura), pasando de un EPA bruto de {inf_raw_epa:+.2f} "
        f"a un EPA competitivo de {inf_epa:+.2f} (WPA de {inf_wpa:+.3f}, CPOE de {inf_cpoe:+.2f}%) "
        f"con un Indice de Inflacion Estadistica de {inf_index:.2f}."
    )
    return sanitize_text(summary)


def _build_deterministic_critiques(
    rankings_data: dict[str, Any],
    scoreboard_data: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Genera la lista estructurada de crónicas analíticas para jugadores y partidos."""
    critiques: list[dict[str, Any]] = []
    players = rankings_data.get("players", [])
    mvp = rankings_data.get("mvp_real") or (players[0] if players else None)
    inflated = rankings_data.get("inflated_stat_leader")

    if mvp:
        m_name = mvp.get("player_name", "N/A")
        m_pos = mvp.get("position", "QB")
        m_team = mvp.get("team", "NFL")
        m_epa = float(mvp.get("epa_total", 0.0))
        m_epa_play = float(mvp.get("epa_per_play", 0.0))
        m_wpa = float(mvp.get("wpa_total", 0.0))
        m_cpoe = float(mvp.get("cpoe", 0.0))
        m_sr = float(mvp.get("success_rate", 0.0)) * 100.0
        m_score = float(mvp.get("impact_score", 0.0))
        m_comp_yards = float(mvp.get("competitive_yards", 0.0))

        body = (
            f"Designacion de MVP Real: {m_name} ({m_pos} - {m_team}) lidera el modelo de valoracion "
            f"con Impact Score de {m_score:.1f}/100 tras filtrar minutos basura. "
            f"En situaciones competitivas genera {m_epa:+.2f} EPA total ({m_epa_play:+.3f} EPA/jugada), "
            f"WPA de {m_wpa:+.3f}, CPOE de {m_cpoe:+.2f}%, Success Rate de {m_sr:.1f}% y "
            f"{m_comp_yards:.0f} yardas netas competitivas."
        )
        critiques.append(
            {
                "id": f"mvp-real-{mvp.get('player_id', 'top')}",
                "title": f"MVP Real: {m_name} ({m_team})",
                "subtitle": f"Impact Score {m_score:.1f} - EPA {m_epa:+.2f} - WPA {m_wpa:+.3f}",
                "category": "MVP Real",
                "teams": [m_team],
                "body": sanitize_text(body),
                "metrics_cited": {
                    "impact_score": m_score,
                    "epa_total": m_epa,
                    "epa_per_play": m_epa_play,
                    "wpa_total": m_wpa,
                    "cpoe": m_cpoe,
                    "success_rate_pct": round(m_sr, 1),
                },
            }
        )

    if inflated:
        i_name = inflated.get("player_name", "N/A")
        i_pos = inflated.get("position", "QB")
        i_team = inflated.get("team", "NFL")
        i_raw_y = float(inflated.get("raw_yards", 0.0))
        i_comp_y = float(inflated.get("competitive_yards", 0.0))
        i_gt_y = float(inflated.get("garbage_time_yards", 0.0))
        i_gt_plays = int(inflated.get("garbage_time_plays", 0))
        i_epa = float(inflated.get("epa_total", 0.0))
        i_raw_epa = float(inflated.get("raw_epa_total", 0.0))
        i_wpa = float(inflated.get("wpa_total", 0.0))
        i_cpoe = float(inflated.get("cpoe", 0.0))
        i_idx = float(inflated.get("inflation_index", 0.0))

        body = (
            f"Alerta de Estadistico Inflado: {i_name} ({i_pos} - {i_team}) acumula {i_raw_y:.0f} yardas brutas, "
            f"pero {i_gt_y:.0f} yardas provienen de {i_gt_plays} jugadas en minutos basura (4to cuarto con WP < 5% o WP > 95%). "
            f"Su produccion real se reduce a {i_comp_y:.0f} yardas competitivas con EPA competitivo de {i_epa:+.2f} "
            f"(frente a {i_raw_epa:+.2f} EPA bruto), WPA de {i_wpa:+.3f}, CPOE de {i_cpoe:+.2f}% "
            f"e Indice de Inflacion Estadistica de {i_idx:.2f}."
        )
        critiques.append(
            {
                "id": f"inflated-{inflated.get('player_id', 'leader')}",
                "title": f"Estadistico Inflado: {i_name} ({i_team})",
                "subtitle": f"Inflacion {i_idx:.2f} - {i_gt_y:.0f} yds en minutos basura - EPA {i_epa:+.2f}",
                "category": "Estadístico Inflado",
                "teams": [i_team],
                "body": sanitize_text(body),
                "metrics_cited": {
                    "inflation_index": i_idx,
                    "raw_yards": i_raw_y,
                    "competitive_yards": i_comp_y,
                    "garbage_time_yards": i_gt_y,
                    "epa_total": i_epa,
                    "raw_epa_total": i_raw_epa,
                    "wpa_total": i_wpa,
                    "cpoe": i_cpoe,
                },
            }
        )

    # Crónicas por líder posicional (RB, WR, TE)
    for pos in ("RB", "WR", "TE"):
        pos_players = [p for p in players if p.get("position") == pos]
        if not pos_players:
            continue
        leader = pos_players[0]
        p_name = leader.get("player_name", "N/A")
        p_team = leader.get("team", "NFL")
        p_score = float(leader.get("impact_score", 0.0))
        p_epa = float(leader.get("epa_total", 0.0))
        p_epa_play = float(leader.get("epa_per_play", 0.0))
        p_wpa = float(leader.get("wpa_total", 0.0))
        p_cpoe = float(leader.get("cpoe", 0.0))
        p_yac = float(leader.get("yac_epa", 0.0))
        p_sr = float(leader.get("success_rate", 0.0)) * 100.0

        body = (
            f"Lider posicional {pos}: {p_name} ({p_team}) registra Impact Score de {p_score:.1f}/100 "
            f"con EPA competitivo total de {p_epa:+.2f} ({p_epa_play:+.3f} EPA/oportunidad), "
            f"WPA de {p_wpa:+.3f}, CPOE de {p_cpoe:+.2f}%, YAC EPA de {p_yac:+.2f} y Success Rate de {p_sr:.1f}%."
        )
        critiques.append(
            {
                "id": f"pos-leader-{pos.lower()}-{leader.get('player_id', pos)}",
                "title": f"Referente {pos}: {p_name} ({p_team})",
                "subtitle": f"Impact Score {p_score:.1f} - EPA/jugada {p_epa_play:+.3f} - WPA {p_wpa:+.3f}",
                "category": f"Lider {pos}",
                "teams": [p_team],
                "body": sanitize_text(body),
                "metrics_cited": {
                    "impact_score": p_score,
                    "epa_total": p_epa,
                    "epa_per_play": p_epa_play,
                    "wpa_total": p_wpa,
                    "cpoe": p_cpoe,
                    "yac_epa": p_yac,
                },
            }
        )

    # Crónicas de partidos y momentos críticos de ESPN (`live_scoreboard.json`)
    games = (scoreboard_data or {}).get("games", [])
    for game in games[:6]:
        game_id = str(game.get("event_id") or game.get("id") or "game")
        away = game.get("away_team", {})
        home = game.get("home_team", {})
        away_abbr = away.get("abbreviation") or away.get("short_name") or game.get("away_abbr") or "AWAY"
        home_abbr = home.get("abbreviation") or home.get("short_name") or game.get("home_abbr") or "HOME"
        away_score = away.get("score", game.get("away_score", 0))
        home_score = home.get("score", game.get("home_score", 0))
        wp_obj = game.get("win_probability") if isinstance(game.get("win_probability"), dict) else {}
        home_wp = float(
            game.get("home_win_probability")
            or wp_obj.get("home_wp")
            or wp_obj.get("home")
            or 0.5
        )
        moments = game.get("critical_moments") or game.get("critical_plays") or []

        if moments:
            top_m = moments[0]
            delta_wp = float(top_m.get("delta_wp", 0.0))
            abs_delta = float(top_m.get("abs_delta_wp", abs(delta_wp)))
            desc = sanitize_text(str(top_m.get("description") or top_m.get("play_text") or "Jugada clave"))
            qtr_val = top_m.get("period") or top_m.get("qtr") or 4
            game_body = (
                f"Marcador {away_abbr} {away_score} - {home_abbr} {home_score} (WP local: {home_wp * 100:.1f}%). "
                f"Momento critico principal en Q{qtr_val} con variacion de probabilidad de victoria "
                f"delta_wp de {delta_wp:+.3f} (|delta_wp| = {abs_delta:.3f}, WPA equivalente {delta_wp:+.3f}): {desc}"
            )
        else:
            delta_wp = 0.0
            game_body = (
                f"Marcador {away_abbr} {away_score} - {home_abbr} {home_score} (WP local: {home_wp * 100:.1f}%). "
                f"Sin jugadas con variacion |delta_wp| >= 0.12 registradas en el corte actual (EPA/WPA neutral: 0.000)."
            )

        critiques.append(
            {
                "id": f"game-critique-{game_id}",
                "title": f"Auditoria de Partido: {away_abbr} {away_score} - {home_abbr} {home_score}",
                "subtitle": f"WP Local {home_wp * 100:.1f}% - Max |delta_wp| {abs(delta_wp):.3f}",
                "category": "Partido",
                "teams": [away_abbr, home_abbr],
                "body": sanitize_text(game_body),
                "metrics_cited": {
                    "home_wp": round(home_wp, 4),
                    "delta_wp": round(delta_wp, 4),
                    "critical_plays_count": len(moments),
                },
            }
        )

    return critiques


def _call_gemini_critique(prompt: str, api_key: str) -> str | None:
    """Invoca Gemini (`gemini-3.8-flash`) usando el SDK oficial `google-genai`."""
    client = genai.Client(api_key=api_key)
    if hasattr(client, "interactions"):
        interaction = client.interactions.create(
            model=MODEL_NAME,
            input=prompt,
            system_instruction=SYSTEM_PROMPT,
        )
        text = getattr(interaction, "output_text", None)
        if text and str(text).strip():
            return sanitize_text(str(text).strip())

    if hasattr(client, "models"):
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=f"{SYSTEM_PROMPT}\n\n{prompt}",
        )
        text = getattr(response, "text", None)
        if text and str(text).strip():
            return sanitize_text(str(text).strip())

    return None


def generate_critiques(
    rankings_data: dict[str, Any] | None = None,
    scoreboard_data: dict[str, Any] | None = None,
    output_path: Path | str | None = None,
    api_key: str | None = None,
) -> dict[str, Any]:
    """Genera las crónicas críticas y guarda `public/data/game_critiques.json`."""
    if rankings_data is None:
        if DEFAULT_RANKINGS_PATH.exists():
            rankings_data = json.loads(DEFAULT_RANKINGS_PATH.read_text(encoding="utf-8"))
        else:
            rankings_data = {"season": datetime.now(timezone.utc).year, "players": []}

    if scoreboard_data is None and DEFAULT_SCOREBOARD_PATH.exists():
        try:
            scoreboard_data = json.loads(DEFAULT_SCOREBOARD_PATH.read_text(encoding="utf-8"))
        except Exception:
            scoreboard_data = {"games": []}

    players = rankings_data.get("players", [])
    mvp = rankings_data.get("mvp_real") or (players[0] if players else {})
    inflated = rankings_data.get("inflated_stat_leader") or (players[-1] if players else {})
    season = int(rankings_data.get("season", datetime.now(timezone.utc).year))

    deterministic_summary = _build_deterministic_summary(mvp, inflated, season)
    critiques_list = _build_deterministic_critiques(rankings_data, scoreboard_data)

    resolved_key = api_key if api_key is not None else os.environ.get("GEMINI_API_KEY", "").strip()
    generation_mode = "deterministic_template"
    executive_summary = deterministic_summary

    if resolved_key:
        prompt = (
            f"Datos auditados de la temporada {season}:\n"
            f"- MVP Real: {json.dumps(mvp, ensure_ascii=False)}\n"
            f"- Estadistico Inflado: {json.dumps(inflated, ensure_ascii=False)}\n"
            f"Redacta un resumen ejecutivo de 1 parrafo que senale explicitamente al 'MVP Real' y al "
            f"'Estadistico Inflado', citando sus metricas exactas de EPA, WPA, CPOE e Impact Score. "
            f"Recuerda: prohibido usar guion largo, usa solo guion simple (-)."
        )
        try:
            ai_summary = _call_gemini_critique(prompt, resolved_key)
            if ai_summary:
                # Garantizar que las etiquetas requeridas y métricas estén presentes
                if "MVP Real" in ai_summary and ("Estadístico Inflado" in ai_summary or "Estadistico Inflado" in ai_summary):
                    executive_summary = sanitize_text(ai_summary)
                else:
                    executive_summary = sanitize_text(f"{ai_summary} - {deterministic_summary}")
                generation_mode = MODEL_NAME
        except Exception:
            generation_mode = "deterministic_template"
            executive_summary = deterministic_summary

    payload: dict[str, Any] = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "season": season,
        "generation_mode": generation_mode,
        "executive_summary": sanitize_text(executive_summary),
        "mvp_real": mvp,
        "inflated_player": inflated,
        "inflated_stat_leader": inflated,
        "critiques": critiques_list,
    }

    clean_payload = _sanitize_payload(payload)

    target_path = Path(output_path) if output_path is not None else DEFAULT_OUTPUT_PATH
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(json.dumps(clean_payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return clean_payload


if __name__ == "__main__":
    generate_critiques()
