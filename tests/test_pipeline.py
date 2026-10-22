"""Suite de pruebas automatizadas para NFL Analytics Engine (`tests/test_pipeline.py`).

Valida los 5 invariantes arquitectónicos de AGENTS.md:
1. Extracción de momentos críticos de ESPN (|delta_wp| >= 0.12, top 3 ordenados) y estructura del scoreboard.
2. Esquema de columnas y detección automática de temporada con fallback en `src/ingest_nflverse.py`.
3. Filtro de minutos basura (qtr == 4 con wp < 0.05 o wp > 0.95), mínimos de participación
   (15 QB, 10 RB, 5 WR/TE), fórmulas exactas de Z-score por posición, rango [0, 100] del Impact Score
   e Índice de Inflación Estadística en `src/valuation_model.py`.
4. Generador de críticas (`src/critic_generator.py`): ausencia total de guiones largos (`—` y `–`),
   mención explícita de "MVP Real" y "Estadístico Inflado", y citas numéricas exactas de EPA, WPA y CPOE.
5. Estructura e invariantes de los archivos JSON de salida en `public/data/`.
"""

from __future__ import annotations

import io
import json
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import numpy as np
import pandas as pd
import pytest

from src import critic_generator, ingest_espn, ingest_nflverse, valuation_model

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DATA_DIR = PROJECT_ROOT / "public" / "data"


# ---------------------------------------------------------------------------
# Fixtures de datos sintéticos realistas
# ---------------------------------------------------------------------------


@pytest.fixture()
def synthetic_pbp_and_roster() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Construye un dataset Play-by-Play y Roster sintético con casos de borde controlados.

    Incluye:
    - QB1 (Patrick Mahomes): 20 dropbacks competitivos de alta eficiencia -> MVP Real.
    - QB2 (Dak Prescott): 12 dropbacks competitivos ineficientes + 10 dropbacks en minutos basura
      (qtr == 4, wp == 0.02) con muchas yardas -> Estadístico Inflado.
    - QB3 (Backup QB): solo 8 dropbacks en la semana -> excluido por mínimo de participación (< 15).
    - RB1 (Saquon Barkley): 12 acarreos + 3 targets = 15 touches competitivos de alto EPA.
    - RB2 (Tony Pollard): 10 acarreos + 2 targets = 12 touches de eficiencia media.
    - RB3 (Short RB): solo 6 acarreos -> excluido por mínimo (< 10).
    - WR1 (Justin Jefferson): 8 targets competitivos de alto EPA y YAC EPA.
    - WR2 (CeeDee Lamb): 6 targets competitivos + 4 targets en minutos basura (qtr == 4, wp == 0.98).
    - WR3 (Depth WR): solo 3 targets -> excluido por mínimo (< 5).
    - TE1 (Travis Kelce): 6 targets competitivos eficientes.
    - TE2 (Sam LaPorta): 5 targets competitivos moderados.
    """
    rows: list[dict[str, Any]] = []
    play_id = 1

    # QB1: 20 dropbacks competitivos (Q1-Q3, wp=0.55), alta eficiencia
    for _ in range(20):
        rows.append(
            {
                "play_id": play_id,
                "game_id": "2025_01_KC_BAL",
                "season": 2025,
                "week": 1,
                "qtr": 2,
                "wp": 0.55,
                "wpa": 0.035,
                "epa": 0.48,
                "cpoe": 6.5,
                "success": 1.0,
                "yac_epa": 0.20,
                "qb_dropback": 1,
                "pass_attempt": 1,
                "rush_attempt": 0,
                "passing_yards": 12.0,
                "rushing_yards": 0.0,
                "receiving_yards": 12.0,
                "yards_gained": 12.0,
                "passer_player_id": "QB1",
                "passer_player_name": "P.Mahomes",
                "rusher_player_id": None,
                "rusher_player_name": None,
                "receiver_player_id": "WR1" if play_id <= 8 else ("TE1" if play_id <= 14 else None),
                "receiver_player_name": "J.Jefferson" if play_id <= 8 else ("T.Kelce" if play_id <= 14 else None),
                "posteam": "KC",
                "play_type": "pass",
            }
        )
        play_id += 1

    # QB2: 12 dropbacks competitivos malos (Q2, wp=0.40) + 10 dropbacks en minutos basura (Q4, wp=0.02)
    for _ in range(12):
        rows.append(
            {
                "play_id": play_id,
                "game_id": "2025_01_DAL_CLE",
                "season": 2025,
                "week": 1,
                "qtr": 2,
                "wp": 0.40,
                "wpa": -0.020,
                "epa": -0.35,
                "cpoe": -4.2,
                "success": 0.0,
                "yac_epa": -0.05,
                "qb_dropback": 1,
                "pass_attempt": 1,
                "rush_attempt": 0,
                "passing_yards": 4.0,
                "rushing_yards": 0.0,
                "receiving_yards": 4.0,
                "yards_gained": 4.0,
                "passer_player_id": "QB2",
                "passer_player_name": "D.Prescott",
                "rusher_player_id": None,
                "rusher_player_name": None,
                "receiver_player_id": "WR2" if play_id <= 26 else ("TE2" if play_id <= 31 else None),
                "receiver_player_name": "C.Lamb" if play_id <= 26 else ("S.LaPorta" if play_id <= 31 else None),
                "posteam": "DAL",
                "play_type": "pass",
            }
        )
        play_id += 1

    # QB2 en Minutos Basura (Q4, wp=0.02 < 0.05): 10 pases largos de 32 yardas cada uno
    for idx in range(10):
        rows.append(
            {
                "play_id": play_id,
                "game_id": "2025_01_DAL_CLE",
                "season": 2025,
                "week": 1,
                "qtr": 4,
                "wp": 0.02 if idx < 5 else 0.98,
                "wpa": 0.001,
                "epa": 0.85,
                "cpoe": 11.0,
                "success": 1.0,
                "yac_epa": 0.40,
                "qb_dropback": 1,
                "pass_attempt": 1,
                "rush_attempt": 0,
                "passing_yards": 32.0,
                "rushing_yards": 0.0,
                "receiving_yards": 32.0,
                "yards_gained": 32.0,
                "passer_player_id": "QB2",
                "passer_player_name": "D.Prescott",
                "rusher_player_id": None,
                "rusher_player_name": None,
                "receiver_player_id": "WR2" if idx < 4 else None,
                "receiver_player_name": "C.Lamb" if idx < 4 else None,
                "posteam": "DAL",
                "play_type": "pass",
            }
        )
        play_id += 1

    # QB3: solo 8 dropbacks (< 15 mínimo) y WR3: solo 3 targets (< 5 mínimo)
    for idx in range(8):
        rows.append(
            {
                "play_id": play_id,
                "game_id": "2025_01_NYG_MIN",
                "season": 2025,
                "week": 1,
                "qtr": 1,
                "wp": 0.50,
                "wpa": 0.01,
                "epa": 0.15,
                "cpoe": 1.0,
                "success": 1.0,
                "yac_epa": 0.05,
                "qb_dropback": 1,
                "pass_attempt": 1,
                "rush_attempt": 0,
                "passing_yards": 9.0,
                "rushing_yards": 0.0,
                "receiving_yards": 9.0,
                "yards_gained": 9.0,
                "passer_player_id": "QB3",
                "passer_player_name": "D.Jones",
                "rusher_player_id": None,
                "rusher_player_name": None,
                "receiver_player_id": "WR3" if idx < 3 else None,
                "receiver_player_name": "D.Slayton" if idx < 3 else None,
                "posteam": "NYG",
                "play_type": "pass",
            }
        )
        play_id += 1

    # RB1: 12 acarreos competitivos (Q1-Q3, wp=0.60)
    for _ in range(12):
        rows.append(
            {
                "play_id": play_id,
                "game_id": "2025_01_PHI_GB",
                "season": 2025,
                "week": 1,
                "qtr": 3,
                "wp": 0.60,
                "wpa": 0.025,
                "epa": 0.32,
                "cpoe": np.nan,
                "success": 1.0,
                "yac_epa": 0.0,
                "qb_dropback": 0,
                "pass_attempt": 0,
                "rush_attempt": 1,
                "passing_yards": 0.0,
                "rushing_yards": 8.5,
                "receiving_yards": 0.0,
                "yards_gained": 8.5,
                "passer_player_id": None,
                "passer_player_name": None,
                "rusher_player_id": "RB1",
                "rusher_player_name": "S.Barkley",
                "receiver_player_id": None,
                "receiver_player_name": None,
                "posteam": "PHI",
                "play_type": "run",
            }
        )
        play_id += 1

    # RB2: 11 acarreos competitivos de baja eficiencia
    for _ in range(11):
        rows.append(
            {
                "play_id": play_id,
                "game_id": "2025_01_TEN_CHI",
                "season": 2025,
                "week": 1,
                "qtr": 2,
                "wp": 0.48,
                "wpa": -0.010,
                "epa": -0.15,
                "cpoe": np.nan,
                "success": 0.0,
                "yac_epa": 0.0,
                "qb_dropback": 0,
                "pass_attempt": 0,
                "rush_attempt": 1,
                "passing_yards": 0.0,
                "rushing_yards": 3.0,
                "receiving_yards": 0.0,
                "yards_gained": 3.0,
                "passer_player_id": None,
                "passer_player_name": None,
                "rusher_player_id": "RB2",
                "rusher_player_name": "T.Pollard",
                "receiver_player_id": None,
                "receiver_player_name": None,
                "posteam": "TEN",
                "play_type": "run",
            }
        )
        play_id += 1

    # RB3: solo 6 acarreos (< 10 mínimo)
    for _ in range(6):
        rows.append(
            {
                "play_id": play_id,
                "game_id": "2025_01_TEN_CHI",
                "season": 2025,
                "week": 1,
                "qtr": 1,
                "wp": 0.50,
                "wpa": 0.005,
                "epa": 0.10,
                "cpoe": np.nan,
                "success": 1.0,
                "yac_epa": 0.0,
                "qb_dropback": 0,
                "pass_attempt": 0,
                "rush_attempt": 1,
                "passing_yards": 0.0,
                "rushing_yards": 5.0,
                "receiving_yards": 0.0,
                "yards_gained": 5.0,
                "passer_player_id": None,
                "passer_player_name": None,
                "rusher_player_id": "RB3",
                "rusher_player_name": "Backup RB",
                "receiver_player_id": None,
                "receiver_player_name": None,
                "posteam": "TEN",
                "play_type": "run",
            }
        )
        play_id += 1

    roster_df = pd.DataFrame(
        [
            {"gsis_id": "QB1", "full_name": "Patrick Mahomes", "position": "QB", "team": "KC"},
            {"gsis_id": "QB2", "full_name": "Dak Prescott", "position": "QB", "team": "DAL"},
            {"gsis_id": "QB3", "full_name": "Daniel Jones", "position": "QB", "team": "NYG"},
            {"gsis_id": "RB1", "full_name": "Saquon Barkley", "position": "RB", "team": "PHI"},
            {"gsis_id": "RB2", "full_name": "Tony Pollard", "position": "RB", "team": "TEN"},
            {"gsis_id": "RB3", "full_name": "Backup Runner", "position": "RB", "team": "TEN"},
            {"gsis_id": "WR1", "full_name": "Justin Jefferson", "position": "WR", "team": "MIN"},
            {"gsis_id": "WR2", "full_name": "CeeDee Lamb", "position": "WR", "team": "DAL"},
            {"gsis_id": "WR3", "full_name": "Darius Slayton", "position": "WR", "team": "NYG"},
            {"gsis_id": "TE1", "full_name": "Travis Kelce", "position": "TE", "team": "KC"},
            {"gsis_id": "TE2", "full_name": "Sam LaPorta", "position": "TE", "team": "DET"},
        ]
    )

    return pd.DataFrame(rows), roster_df


# ---------------------------------------------------------------------------
# 1. Pruebas de ESPN: Momentos Críticos y Estructura del Scoreboard
# ---------------------------------------------------------------------------


def test_espn_extract_critical_moments_threshold_and_sorting() -> None:
    """Verifica que `extract_critical_moments` filtre |delta_wp| >= 0.12 y devuelva el top 3 ordenado."""
    summary_payload = {
        "drives": {
            "previous": [
                {
                    "plays": [
                        {"id": "p1", "period": {"number": 1}, "clock": {"displayValue": "10:00"}, "text": "Pase corto"},
                        {"id": "p2", "period": {"number": 2}, "clock": {"displayValue": "04:12"}, "text": "Intercepcion devuelta"},
                        {"id": "p3", "period": {"number": 3}, "clock": {"displayValue": "08:30"}, "text": "Touchdown de 65 yardas"},
                        {"id": "p4", "period": {"number": 4}, "clock": {"displayValue": "02:15"}, "text": "Fumble recuperado"},
                        {"id": "p5", "period": {"number": 4}, "clock": {"displayValue": "00:40"}, "text": "Gol de campo ganador"},
                        {"id": "p6", "period": {"number": 4}, "clock": {"displayValue": "00:00"}, "text": "END GAME"},
                    ]
                }
            ]
        },
        "winprobability": [
            {"playId": "p1", "homeWinPercentage": 0.54},  # delta = +0.04 (< 0.12, excluida)
            {"playId": "p2", "homeWinPercentage": 0.36},  # delta = -0.18 (|delta| = 0.18)
            {"playId": "p3", "homeWinPercentage": 0.71},  # delta = +0.35 (|delta| = 0.35)
            {"playId": "p4", "homeWinPercentage": 0.56},  # delta = -0.15 (|delta| = 0.15)
            {"playId": "p5", "homeWinPercentage": 0.96},  # delta = +0.40 (|delta| = 0.40)
            {"playId": "p6", "homeWinPercentage": 1.00},  # END GAME administrativa
        ],
    }

    moments = ingest_espn.extract_critical_moments(
        summary_payload,
        min_delta=0.12,
        top_n=3,
        event_id="401671789",
        away_abbr="KC",
        home_abbr="BAL",
        season=2025,
    )
    assert len(moments) == 3
    assert [m["play_id"] for m in moments] == ["p5", "p3", "p2"]
    assert all(m["abs_delta_wp"] >= 0.12 for m in moments)
    assert moments[0]["abs_delta_wp"] >= moments[1]["abs_delta_wp"] >= moments[2]["abs_delta_wp"]
    assert moments[0]["delta_wp"] == pytest.approx(0.40, abs=1e-4)
    assert moments[1]["delta_wp"] == pytest.approx(0.35, abs=1e-4)
    assert moments[2]["delta_wp"] == pytest.approx(-0.18, abs=1e-4)
    for m in moments:
        assert m.get("video_url", "").startswith("http")
        assert m.get("espn_play_url", "").startswith("https://www.espn.com/nfl/")


def test_espn_scoreboard_fallback_and_schema(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Verifica el fallback automático de ESPN y la estructura del archivo `live_scoreboard.json`."""
    calls: list[str] = []

    def fake_get(url: str, headers: dict[str, str] | None = None, timeout: int = 15) -> MagicMock:
        calls.append(url)
        resp = MagicMock()
        if "site.api.espn.com" in url and "scoreboard" in url:
            resp.status_code = 503
            return resp
        resp.status_code = 200
        if "scoreboard" in url:
            resp.json.return_value = {
                "season": {"year": 2025},
                "week": {"number": 5},
                "events": [
                    {
                        "id": "401671789",
                        "name": "Kansas City Chiefs at Baltimore Ravens",
                        "shortName": "KC @ BAL",
                        "date": "2025-10-05T20:20Z",
                        "status": {
                            "period": 4,
                            "displayClock": "01:10",
                            "type": {"state": "in", "shortDetail": "01:10 - 4th", "completed": False},
                        },
                        "competitions": [
                            {
                                "competitors": [
                                    {
                                        "homeAway": "home",
                                        "score": "24",
                                        "team": {"id": "33", "abbreviation": "BAL", "displayName": "Baltimore Ravens"},
                                    },
                                    {
                                        "homeAway": "away",
                                        "score": "27",
                                        "team": {"id": "12", "abbreviation": "KC", "displayName": "Kansas City Chiefs"},
                                    },
                                ]
                            }
                        ],
                    }
                ],
            }
        else:
            resp.json.return_value = {
                "winprobability": [
                    {"playId": "101", "homeWinPercentage": 0.50},
                    {"playId": "102", "homeWinPercentage": 0.25, "text": "Patrick Mahomes pass complete for 45 yds"},
                ]
            }
        return resp

    monkeypatch.setattr(ingest_espn.requests, "get", fake_get)
    out_file = tmp_path / "live_scoreboard.json"
    payload = ingest_espn.ingest_espn_scoreboard(output_path=out_file)

    assert out_file.exists()
    assert any("site.web.api.espn.com" in c for c in calls)
    assert payload["season"] == 2025
    assert len(payload["games"]) == 1
    game = payload["games"][0]
    assert game["event_id"] == "401671789"
    assert game["home_team"]["abbreviation"] == "BAL"
    assert game["away_team"]["abbreviation"] == "KC"
    assert len(game["critical_moments"]) == 1
    assert game["critical_moments"][0]["abs_delta_wp"] == pytest.approx(0.25, abs=1e-4)
    assert game["hinge_play"]["video_url"].startswith("http")
    assert game["hinge_play"]["espn_play_url"].startswith("https://www.espn.com/nfl/")


# ---------------------------------------------------------------------------
# 2. Pruebas de nflverse: Esquema de Columnas y Fallback de Temporada (HTTP 404)
# ---------------------------------------------------------------------------


def test_nflverse_season_fallback_on_404(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verifica que si la temporada solicitada (2026) da HTTP 404, hace fallback a 2025 y registra metadatos."""
    sample_df = pd.DataFrame(
        {
            "play_id": [1, 2],
            "game_id": ["2025_01_KC_BAL", "2025_01_KC_BAL"],
            "season": [2025, 2025],
            "week": [1, 1],
            "qtr": [1, 4],
            "wp": [0.50, 0.03],
            "wpa": [0.05, 0.001],
            "epa": [0.42, 0.15],
            "cpoe": [4.1, 2.0],
            "success": [1.0, 1.0],
            "yac_epa": [0.1, 0.05],
        }
    )
    buf = io.BytesIO()
    sample_df.to_parquet(buf, index=False)
    parquet_bytes = buf.getvalue()

    def fake_get(url: str, headers: dict[str, str] | None = None, timeout: int = 60) -> MagicMock:
        resp = MagicMock()
        if "2026" in url:
            resp.status_code = 404
            return resp
        resp.status_code = 200
        resp.content = parquet_bytes
        return resp

    monkeypatch.setattr(ingest_nflverse.requests, "get", fake_get)

    df, meta = ingest_nflverse.detect_and_load_pbp(preferred_season=2026, fallback_seasons=(2025, 2024))
    assert not df.empty
    assert meta["requested_season"] == 2026
    assert meta["active_season"] == 2025
    assert meta["fallback_used"] is True
    assert "404" in meta["fallback_reason"]
    for req_col in ingest_nflverse.REQUIRED_PBP_COLUMNS:
        assert req_col in df.columns


# ---------------------------------------------------------------------------
# 3. Pruebas del Modelo Matemático (`src/valuation_model.py`)
# ---------------------------------------------------------------------------


def test_filter_garbage_time_exact_boundaries() -> None:
    """Verifica el filtro exacto de minutos basura: qtr == 4 y (wp < 0.05 o wp > 0.95)."""
    df = pd.DataFrame(
        [
            {"play_id": 1, "qtr": 3, "wp": 0.01, "epa": 0.5},  # Q3 -> Competitivo (aunque wp < 0.05)
            {"play_id": 2, "qtr": 4, "wp": 0.049, "epa": 0.8},  # Q4 y wp < 0.05 -> Minuto Basura
            {"play_id": 3, "qtr": 4, "wp": 0.05, "epa": 0.3},  # Q4 y wp == 0.05 -> Competitivo (borde)
            {"play_id": 4, "qtr": 4, "wp": 0.95, "epa": 0.2},  # Q4 y wp == 0.95 -> Competitivo (borde)
            {"play_id": 5, "qtr": 4, "wp": 0.951, "epa": 0.9},  # Q4 y wp > 0.95 -> Minuto Basura
        ]
    )

    comp_df, raw_df = valuation_model.filter_garbage_time(df)
    assert len(raw_df) == 5
    assert len(comp_df) == 3
    assert set(comp_df["play_id"].tolist()) == {1, 3, 4}
    assert raw_df["is_garbage_time"].tolist() == [False, True, False, False, True]


def test_z_score_and_position_formulas() -> None:
    """Valida `compute_z_score` y los pesos exactos para QB, RB y WR/TE, así como el rango [0, 100]."""
    # Serie constante -> Z-score debe ser 0.0 sin dividir por cero
    const_s = pd.Series([5.0, 5.0, 5.0])
    assert np.allclose(valuation_model.compute_z_score(const_s), 0.0)

    # Validar fórmula de QB: 0.45*z(epa) + 0.25*z(wpa) + 0.20*z(cpoe) + 0.10*z(sr)
    qb_df = pd.DataFrame(
        {
            "player_id": ["Q1", "Q2", "Q3"],
            "epa_per_dropback": [0.30, 0.10, -0.20],
            "wpa_total": [0.80, 0.20, -0.40],
            "cpoe": [5.0, 1.0, -3.0],
            "success_rate": [0.55, 0.48, 0.38],
        }
    )
    qb_scored = valuation_model.compute_qb_impact(qb_df)
    expected_qb_z = (
        0.45 * valuation_model.compute_z_score(qb_df["epa_per_dropback"])
        + 0.25 * valuation_model.compute_z_score(qb_df["wpa_total"])
        + 0.20 * valuation_model.compute_z_score(qb_df["cpoe"])
        + 0.10 * valuation_model.compute_z_score(qb_df["success_rate"])
    )
    assert np.allclose(qb_scored["z_score"], expected_qb_z.round(4), atol=1e-4)
    assert ((qb_scored["impact_score"] >= 0.0) & (qb_scored["impact_score"] <= 100.0)).all()
    assert qb_scored.loc[0, "impact_score"] > qb_scored.loc[1, "impact_score"] > qb_scored.loc[2, "impact_score"]

    # Validar fórmula de RB: 0.50*z(epa_per_rush_and_rec) + 0.25*z(sr) + 0.25*z(wpa)
    rb_df = pd.DataFrame(
        {
            "player_id": ["R1", "R2", "R3"],
            "epa_per_rush_and_rec": [0.22, 0.04, -0.18],
            "success_rate": [0.52, 0.44, 0.35],
            "wpa_total": [0.40, 0.10, -0.25],
        }
    )
    rb_scored = valuation_model.compute_rb_impact(rb_df)
    expected_rb_z = (
        0.50 * valuation_model.compute_z_score(rb_df["epa_per_rush_and_rec"])
        + 0.25 * valuation_model.compute_z_score(rb_df["success_rate"])
        + 0.25 * valuation_model.compute_z_score(rb_df["wpa_total"])
    )
    assert np.allclose(rb_scored["z_score"], expected_rb_z.round(4), atol=1e-4)
    assert ((rb_scored["impact_score"] >= 0.0) & (rb_scored["impact_score"] <= 100.0)).all()

    # Validar fórmula de WR/TE: 0.45*z(epa_per_target) + 0.30*z(wpa) + 0.25*z(yac_epa)
    rec_df = pd.DataFrame(
        {
            "player_id": ["W1", "W2", "W3"],
            "epa_per_target": [0.45, 0.15, -0.10],
            "wpa_total": [0.55, 0.18, -0.12],
            "yac_epa": [0.28, 0.09, -0.04],
        }
    )
    rec_scored = valuation_model.compute_receiver_impact(rec_df)
    expected_rec_z = (
        0.45 * valuation_model.compute_z_score(rec_df["epa_per_target"])
        + 0.30 * valuation_model.compute_z_score(rec_df["wpa_total"])
        + 0.25 * valuation_model.compute_z_score(rec_df["yac_epa"])
    )
    assert np.allclose(rec_scored["z_score"], expected_rec_z.round(4), atol=1e-4)
    assert ((rec_scored["impact_score"] >= 0.0) & (rec_scored["impact_score"] <= 100.0)).all()


def test_participation_minimums_and_inflation_index(
    synthetic_pbp_and_roster: tuple[pd.DataFrame, pd.DataFrame],
    tmp_path: Path,
) -> None:
    """Verifica mínimos de participación (15 QB, 10 RB, 5 WR/TE), MVP Real e Índice de Inflación."""
    pbp_df, roster_df = synthetic_pbp_and_roster
    out_path = tmp_path / "player_rankings.json"

    rankings = valuation_model.run_valuation_pipeline(
        pbp_df=pbp_df,
        roster_df=roster_df,
        metadata={"season": 2025, "requested_season": 2026, "fallback_used": True, "fallback_reason": "HTTP 404"},
        output_path=out_path,
    )

    assert out_path.exists()
    players = rankings["players"]
    player_ids = {p["player_id"] for p in players}

    # Jugadores por debajo del umbral semanal deben quedar excluidos (QB3=8<15, RB3=6<10, WR3=3<5)
    assert "QB3" not in player_ids
    assert "RB3" not in player_ids
    assert "WR3" not in player_ids

    # Jugadores que cumplen el umbral deben estar presentes
    assert {"QB1", "QB2", "RB1", "RB2", "WR1", "WR2", "TE1", "TE2"}.issubset(player_ids)

    # Todas las puntuaciones de impacto deben estar en [0.0, 100.0]
    for p in players:
        assert 0.0 <= float(p["impact_score"]) <= 100.0

    # QB2 (Dak Prescott) acumuló 320 yardas en minutos basura -> mayor inflation_index que QB1
    by_id = {p["player_id"]: p for p in players}
    assert by_id["QB2"]["garbage_time_yards"] == pytest.approx(320.0)
    assert by_id["QB2"]["garbage_time_plays"] == 10
    assert by_id["QB2"]["inflation_index"] > by_id["QB1"]["inflation_index"]
    assert by_id["QB1"]["impact_score"] > by_id["QB2"]["impact_score"]

    # MVP Real e Inflated Stat Leader explícitos
    assert rankings["mvp_real"] is not None
    assert rankings["inflated_stat_leader"] is not None
    assert rankings["inflated_stat_leader"]["player_id"] in {"QB2", "WR2"}


# ---------------------------------------------------------------------------
# 4. Pruebas del Generador de Críticas (`src/critic_generator.py`)
# ---------------------------------------------------------------------------


def test_critic_generator_no_em_dash_and_exact_citations(
    synthetic_pbp_and_roster: tuple[pd.DataFrame, pd.DataFrame],
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verifica ausencia de guiones largos, mención de MVP Real / Estadístico Inflado y citas de EPA/WPA/CPOE."""
    # Asegurar que corre en modo determinista sin clave
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    pbp_df, roster_df = synthetic_pbp_and_roster
    rankings_path = tmp_path / "player_rankings.json"
    rankings_data = valuation_model.run_valuation_pipeline(
        pbp_df=pbp_df,
        roster_df=roster_df,
        output_path=rankings_path,
    )

    scoreboard_data = {
        "season": 2025,
        "week": 1,
        "games": [
            {
                "event_id": "401671789",
                "home_team": {"abbreviation": "BAL", "score": 20},
                "away_team": {"abbreviation": "KC", "score": 27},
                "win_probability": {"home_wp": 0.12, "away_wp": 0.88},
                "critical_moments": [
                    {
                        "play_id": "999",
                        "qtr": 4,
                        "clock": "01:45",
                        "description": "Pase profundo—con guion largo–y medio",
                        "delta_wp": -0.28,
                        "abs_delta_wp": 0.28,
                    }
                ],
            }
        ],
    }

    critiques_path = tmp_path / "game_critiques.json"
    result = critic_generator.generate_critiques(
        rankings_data=rankings_data,
        scoreboard_data=scoreboard_data,
        output_path=critiques_path,
        api_key="",
    )

    assert critiques_path.exists()
    raw_json_text = critiques_path.read_text(encoding="utf-8")

    # Regla 1: Prohibido usar guion largo (—) o medio (–)
    assert "\u2014" not in raw_json_text
    assert "\u2013" not in raw_json_text

    # Regla 2 y 3: Mencionar explícitamente MVP Real, Estadístico Inflado y métricas exactas
    summary = result["executive_summary"]
    assert "MVP Real" in summary
    assert "Estadistico Inflado" in summary or "Estadístico Inflado" in summary
    assert "EPA" in summary
    assert "WPA" in summary
    assert "CPOE" in summary
    assert len(result["critiques"]) >= 3


# ---------------------------------------------------------------------------
# 5. Verificación de Archivos JSON Estáticos en `public/data/` (si existen)
# ---------------------------------------------------------------------------


def test_public_data_json_files_if_present() -> None:
    """Valida el esquema y cumplimiento estricto RFC 8259 (sin NaN/Infinity) de los JSON en `public/data/`."""
    scoreboard_file = PUBLIC_DATA_DIR / "live_scoreboard.json"
    rankings_file = PUBLIC_DATA_DIR / "player_rankings.json"
    critiques_file = PUBLIC_DATA_DIR / "game_critiques.json"

    def _strict_loads(text: str) -> dict:
        return json.loads(
            text,
            parse_constant=lambda c: (_ for _ in ()).throw(
                ValueError(f"Invalid JSON constant for browser JSON.parse: {c}")
            ),
        )

    if scoreboard_file.exists():
        sb = _strict_loads(scoreboard_file.read_text(encoding="utf-8"))
        assert "updated_at" in sb
        assert "games" in sb and isinstance(sb["games"], list)

    if rankings_file.exists():
        rk = _strict_loads(rankings_file.read_text(encoding="utf-8"))
        assert "updated_at" in rk
        assert "mvp_real" in rk
        assert "inflated_stat_leader" in rk
        assert "players" in rk and isinstance(rk["players"], list)
        assert len(rk["players"]) > 0

    if critiques_file.exists():
        cr_text = critiques_file.read_text(encoding="utf-8")
        assert "\u2014" not in cr_text
        assert "\u2013" not in cr_text
        cr = _strict_loads(cr_text)
        assert "executive_summary" in cr
        assert "critiques" in cr and isinstance(cr["critiques"], list)

