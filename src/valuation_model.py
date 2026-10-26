"""Modelo Matemático y Actuarial de Valoración Objetiva de Jugadores y Equipos NFL (Multifuente).

Implementa:
1. Filtro de Minutos Basura (Garbage Time): excluye jugadas del 4to cuarto (qtr == 4)
   con probabilidad de victoria previa (wp) < 0.05 o > 0.95.
2. Filtro de participación mínima semanal por posición:
   - QB: >= 15 dropbacks por semana
   - RB: >= 10 acarreos + targets (touches) por semana
   - WR / TE: >= 5 targets por semana
3. Fórmulas exactas de Score de Impacto (escala 0 a 100 vía CDF normal de Z-scores):
   - QB: 0.45 * z(epa_per_dropback) + 0.25 * z(wpa_total) + 0.20 * z(cpoe) + 0.10 * z(success_rate)
   - RB: 0.50 * z(epa_per_rush_and_rec) + 0.25 * z(success_rate) + 0.25 * z(wpa_total)
   - WR / TE: 0.45 * z(epa_per_target) + 0.30 * z(wpa_total) + 0.25 * z(yac_epa)
4. Índice de Inflación Estadística (inflation_index): cuantifica el volumen acumulado
   en minutos basura y la brecha entre yardas brutas y EPA competitivo.
5. Ecosistema Multifuente de 10 Plataformas Estadísticas:
   - Pro Football Reference (PFR AdvStats)
   - RBSDM (EPA+CPOE Composite & PROE)
   - Pro Football Focus (PFF Style Grade 0-100 & Tiers)
   - FTN Fantasy (DVOA Proxy & Formation/Motion Charting)
   - NFL Next Gen Stats (Time to Throw, Separation, Cushion, RYOE, YACOE)
   - SumerSports (Explosive Rate, Shotgun/No-Huddle, Situational Success)
   - PlayerProfiler (Target Share %, Air Yards Share %, WOPR, aDOT, Red Zone Share)
   - Sharp Football Analysis (Early-Down Success, Red Zone EPA, Blitz/Pressure Impact)
   - NFL Savant (6-Zone Field Pass Direction Matrix: Short/Deep x Left/Middle/Right)
   - TeamRankings & OverTheCap / Spotrac (Salary Cap APY, Cap %, Contract ROI)
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from scipy.stats import norm

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT_PATH = PROJECT_ROOT / "public" / "data" / "player_rankings.json"

MIN_OPPORTUNITIES_PER_WEEK: dict[str, int] = {
    "QB": 15,
    "RB": 10,
    "WR": 5,
    "TE": 5,
}

VALID_POSITIONS: set[str] = {"QB", "RB", "WR", "TE"}

# Espacio salarial efectivo estimado (OverTheCap / Spotrac) por franquicia en $M
TEAM_EFFECTIVE_CAP_SPACE_M: dict[str, float] = {
    "NE": 68.4, "LV": 54.2, "WAS": 49.8, "ARI": 46.1, "CHI": 41.5, "DET": 38.9,
    "TEN": 36.4, "LAC": 34.8, "CIN": 32.1, "IND": 29.5, "MIN": 28.4, "DEN": 26.7,
    "GB": 24.3, "SEA": 22.8, "NYJ": 21.4, "TB": 19.8, "HOU": 18.6, "CAR": 17.5,
    "JAX": 16.9, "PIT": 15.4, "NYG": 14.2, "BAL": 12.8, "LAR": 11.6, "PHI": 10.9,
    "KC": 9.4, "ATL": 8.7, "DAL": 7.5, "MIA": 6.2, "SF": 5.8, "BUF": 4.3,
    "CLE": -8.4, "NO": -14.6,
}


def filter_garbage_time(pbp_df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Separa el DataFrame Play-by-Play en jugadas competitivas y jugadas brutas totales.

    Una jugada es considerada minuto basura (Garbage Time) si ocurre en el 4to cuarto
    (`qtr == 4`) y la probabilidad de victoria antes de la jugada (`wp`) es menor a 0.05
    o mayor a 0.95.
    """
    if pbp_df is None or pbp_df.empty:
        empty = pd.DataFrame() if pbp_df is None else pbp_df.copy()
        return empty.copy(), empty.copy()

    raw_df = pbp_df.copy()
    if "season_type" in raw_df.columns:
        non_pre = raw_df["season_type"].fillna("REG").astype(str).str.upper() != "PRE"
        raw_df = raw_df.loc[non_pre].copy()
    qtr = pd.to_numeric(raw_df.get("qtr", pd.Series(1, index=raw_df.index)), errors="coerce").fillna(1)
    wp = pd.to_numeric(raw_df.get("wp", pd.Series(0.5, index=raw_df.index)), errors="coerce").fillna(0.5)

    is_garbage = (qtr == 4) & ((wp < 0.05) | (wp > 0.95))
    raw_df["is_garbage_time"] = is_garbage.astype(bool)
    competitive_df = raw_df.loc[~is_garbage].copy()
    return competitive_df, raw_df


def compute_z_score(series: pd.Series) -> pd.Series:
    """Calcula el Z-score estándar `(series - mean) / std`."""
    if series is None or len(series) == 0:
        return pd.Series(dtype=float)

    clean = pd.to_numeric(series, errors="coerce").fillna(0.0).astype(float)
    if len(clean) <= 1:
        return pd.Series(0.0, index=series.index, dtype=float)

    std = float(clean.std(ddof=1))
    if np.isnan(std) or np.isclose(std, 0.0, atol=1e-12):
        return pd.Series(0.0, index=series.index, dtype=float)

    mean = float(clean.mean())
    return (clean - mean) / std


def z_to_impact_score(z_comp: pd.Series) -> pd.Series:
    """Convierte el Z-score compuesto a escala 0-100 mediante la CDF normal estándar."""
    if z_comp is None or len(z_comp) == 0:
        return pd.Series(dtype=float)

    clean_z = pd.to_numeric(z_comp, errors="coerce").fillna(0.0).astype(float)
    z_restandardized = compute_z_score(clean_z)
    if np.allclose(z_restandardized, 0.0) and not np.allclose(clean_z, 0.0):
        z_input = clean_z
    else:
        z_input = z_restandardized

    scores = np.clip(norm.cdf(z_input) * 100.0, 0.0, 100.0)
    return pd.Series(np.round(scores, 1), index=z_comp.index, dtype=float)


def compute_qb_impact(df: pd.DataFrame) -> pd.DataFrame:
    """Aplica la fórmula actuarial de impacto para Quarterbacks (QB).

    Fórmula:
        z_comp = 0.45 * z(epa_per_dropback) + 0.25 * z(wpa_total) + 0.20 * z(cpoe) + 0.10 * z(success_rate)
    """
    out = df.copy()
    if out.empty:
        out["z_score"] = pd.Series(dtype=float)
        out["impact_score"] = pd.Series(dtype=float)
        return out

    epa_col = "epa_per_dropback" if "epa_per_dropback" in out.columns else "epa_per_play"
    z_epa = compute_z_score(out[epa_col])
    z_wpa = compute_z_score(out["wpa_total"])
    z_cpoe = compute_z_score(out["cpoe"])
    z_sr = compute_z_score(out["success_rate"])

    z_comp = 0.45 * z_epa + 0.25 * z_wpa + 0.20 * z_cpoe + 0.10 * z_sr
    out["z_score"] = z_comp.round(4)
    out["impact_score"] = z_to_impact_score(z_comp)
    return out


def compute_rb_impact(df: pd.DataFrame) -> pd.DataFrame:
    """Aplica la fórmula actuarial de impacto para Running Backs (RB).

    Fórmula:
        z_comp = 0.50 * z(epa_per_rush_and_rec) + 0.25 * z(success_rate) + 0.25 * z(wpa_total)
    """
    out = df.copy()
    if out.empty:
        out["z_score"] = pd.Series(dtype=float)
        out["impact_score"] = pd.Series(dtype=float)
        return out

    epa_col = "epa_per_rush_and_rec" if "epa_per_rush_and_rec" in out.columns else "epa_per_play"
    z_epa = compute_z_score(out[epa_col])
    z_sr = compute_z_score(out["success_rate"])
    z_wpa = compute_z_score(out["wpa_total"])

    z_comp = 0.50 * z_epa + 0.25 * z_sr + 0.25 * z_wpa
    out["z_score"] = z_comp.round(4)
    out["impact_score"] = z_to_impact_score(z_comp)
    return out


def compute_receiver_impact(df: pd.DataFrame) -> pd.DataFrame:
    """Aplica la fórmula actuarial de impacto para Receptores (WR / TE).

    Fórmula:
        z_comp = 0.45 * z(epa_per_target) + 0.30 * z(wpa_total) + 0.25 * z(yac_epa)
    """
    out = df.copy()
    if out.empty:
        out["z_score"] = pd.Series(dtype=float)
        out["impact_score"] = pd.Series(dtype=float)
        return out

    epa_col = "epa_per_target" if "epa_per_target" in out.columns else "epa_per_play"
    z_epa = compute_z_score(out[epa_col])
    z_wpa = compute_z_score(out["wpa_total"])
    z_yac = compute_z_score(out["yac_epa"])

    z_comp = 0.45 * z_epa + 0.30 * z_wpa + 0.25 * z_yac
    out["z_score"] = z_comp.round(4)
    out["impact_score"] = z_to_impact_score(z_comp)
    return out


def _build_roster_lookup(roster_df: pd.DataFrame | None) -> dict[str, dict[str, Any]]:
    """Construye un diccionario `gsis_id -> {position, full_name, team, headshot_url, jersey_number, college, years_exp}`."""
    if roster_df is None or roster_df.empty:
        return {}

    lookup: dict[str, dict[str, Any]] = {}
    id_col = next(
        (c for c in ("gsis_id", "player_id", "id") if c in roster_df.columns),
        None,
    )
    if id_col is None:
        return {}

    pos_col = next(
        (c for c in ("position", "depth_chart_position", "pos") if c in roster_df.columns),
        None,
    )
    name_col = next(
        (c for c in ("full_name", "player_name", "football_name", "name") if c in roster_df.columns),
        None,
    )
    team_col = next(
        (c for c in ("team", "recent_team", "posteam") if c in roster_df.columns),
        None,
    )
    has_headshot = "headshot_url" in roster_df.columns
    has_jersey = "jersey_number" in roster_df.columns
    has_college = "college" in roster_df.columns
    has_exp = "years_exp" in roster_df.columns

    pos_map = {"HB": "RB", "FB": "RB"}

    for _, row in roster_df.iterrows():
        raw_id = row.get(id_col)
        if pd.isna(raw_id) or not str(raw_id).strip():
            continue
        pid = str(raw_id).strip()
        raw_pos = str(row.get(pos_col, "")).strip().upper() if pos_col else ""
        norm_pos = pos_map.get(raw_pos, raw_pos)
        name = str(row.get(name_col, "")).strip() if name_col and pd.notna(row.get(name_col)) else ""
        team = str(row.get(team_col, "")).strip() if team_col and pd.notna(row.get(team_col)) else ""
        headshot = str(row.get("headshot_url", "")).strip() if has_headshot and pd.notna(row.get("headshot_url")) else ""
        jersey = int(float(row.get("jersey_number", 0))) if has_jersey and pd.notna(row.get("jersey_number")) else 0
        college = str(row.get("college", "")).strip() if has_college and pd.notna(row.get("college")) else ""
        years_exp = int(float(row.get("years_exp", 1))) if has_exp and pd.notna(row.get("years_exp")) else 1

        lookup[pid] = {
            "position": norm_pos if norm_pos in VALID_POSITIONS else "",
            "full_name": name,
            "team": team,
            "headshot_url": headshot,
            "jersey_number": jersey,
            "college": college,
            "years_exp": years_exp,
        }
    return lookup


def _build_contracts_lookup(contracts_df: pd.DataFrame | None) -> dict[str, dict[str, float]]:
    """Construye un lookup `gsis_id` o `player_name_lower` -> datos contractuales de OverTheCap."""
    if contracts_df is None or contracts_df.empty:
        return {}

    lookup: dict[str, dict[str, float]] = {}
    work = contracts_df.copy()
    if "is_active" in work.columns:
        active_sub = work.loc[work["is_active"] == True]  # noqa: E712
        if not active_sub.empty:
            work = active_sub
    if "year_signed" in work.columns:
        work = work.sort_values("year_signed", ascending=True)

    for _, row in work.iterrows():
        apy = float(row.get("apy") or 0.0)
        val = float(row.get("value") or 0.0)
        gtd = float(row.get("guaranteed") or 0.0)
        cap_pct = float(row.get("apy_cap_pct") or 0.0) * 100.0 if float(row.get("apy_cap_pct") or 0.0) <= 1.0 else float(row.get("apy_cap_pct") or 0.0)
        years = int(float(row.get("years") or 1))
        if apy <= 0:
            continue
        info = {
            "contract_apy_m": round(apy, 2),
            "contract_total_m": round(val, 2),
            "contract_guaranteed_m": round(gtd, 2),
            "contract_cap_pct": round(cap_pct, 2),
            "contract_years": years,
        }
        gid = str(row.get("gsis_id") or "").strip()
        pname = str(row.get("player") or "").strip().lower()
        if gid and gid != "nan":
            lookup[gid] = info
        if pname:
            lookup[pname] = info
    return lookup


def _extract_role_events(df: pd.DataFrame, roster_lookup: dict[str, dict[str, Any]]) -> pd.DataFrame:
    """Extrae eventos individuales por jugador y rol (passer, rusher, receiver) desde el PBP."""
    cols = [
        "player_id",
        "player_name",
        "team",
        "week",
        "role",
        "explicit_pos",
        "yards",
        "epa",
        "wpa",
        "cpoe",
        "yac_epa",
        "xyac_epa",
        "air_yards",
        "success",
        "is_early_down",
        "is_red_zone",
        "is_explosive",
        "is_pressured",
        "is_complete",
        "is_td",
        "is_int",
        "pass_location",
        "pass_length",
    ]
    if df is None or df.empty:
        return pd.DataFrame(columns=cols)

    work = df.copy()
    if "play_type" in work.columns:
        valid_mask = work["play_type"].isin(["pass", "run"]) | (
            work["play_type"].isna()
            & (
                work.get("passer_player_id", pd.Series(index=work.index, dtype=object)).notna()
                | work.get("rusher_player_id", pd.Series(index=work.index, dtype=object)).notna()
                | work.get("receiver_player_id", pd.Series(index=work.index, dtype=object)).notna()
            )
        )
        work = work.loc[valid_mask].copy()

    if work.empty:
        return pd.DataFrame(columns=cols)

    week_s = pd.to_numeric(work.get("week", pd.Series(1, index=work.index)), errors="coerce").fillna(1).astype(int)
    team_s = work.get("posteam", work.get("team", pd.Series("NFL", index=work.index))).fillna("NFL").astype(str)
    epa_s = pd.to_numeric(work.get("epa", pd.Series(0.0, index=work.index)), errors="coerce").fillna(0.0)
    qb_epa_s = pd.to_numeric(work.get("qb_epa", epa_s), errors="coerce").fillna(epa_s)
    wpa_s = pd.to_numeric(work.get("wpa", pd.Series(0.0, index=work.index)), errors="coerce").fillna(0.0)
    yards_gained_s = pd.to_numeric(work.get("yards_gained", pd.Series(0.0, index=work.index)), errors="coerce").fillna(0.0)
    cpoe_s = pd.to_numeric(work.get("cpoe", pd.Series(np.nan, index=work.index)), errors="coerce")
    yac_epa_s = pd.to_numeric(work.get("yac_epa", pd.Series(0.0, index=work.index)), errors="coerce").fillna(0.0)
    xyac_epa_s = pd.to_numeric(work.get("xyac_epa", pd.Series(0.0, index=work.index)), errors="coerce").fillna(0.0)
    air_yards_s = pd.to_numeric(work.get("air_yards", pd.Series(np.nan, index=work.index)), errors="coerce")

    down_s = pd.to_numeric(work.get("down", pd.Series(1, index=work.index)), errors="coerce").fillna(1)
    yl100_s = pd.to_numeric(work.get("yardline_100", pd.Series(50, index=work.index)), errors="coerce").fillna(50)
    sack_s = pd.to_numeric(work.get("sack", pd.Series(0, index=work.index)), errors="coerce").fillna(0)
    qbhit_s = pd.to_numeric(work.get("qb_hit", pd.Series(0, index=work.index)), errors="coerce").fillna(0)
    comp_s = pd.to_numeric(work.get("complete_pass", pd.Series(0, index=work.index)), errors="coerce").fillna(0)
    td_s = pd.to_numeric(work.get("touchdown", pd.Series(0, index=work.index)), errors="coerce").fillna(0)
    int_s = pd.to_numeric(work.get("interception", pd.Series(0, index=work.index)), errors="coerce").fillna(0)
    pass_loc_s = work.get("pass_location", pd.Series("", index=work.index)).fillna("").astype(str).str.lower()
    pass_len_s = work.get("pass_length", pd.Series("", index=work.index)).fillna("").astype(str).str.lower()

    is_early_down_s = down_s.isin([1, 2]).astype(int)
    is_rz_s = ((yl100_s >= 1) & (yl100_s <= 20)).astype(int)
    is_pressured_s = ((sack_s == 1) | (qbhit_s == 1)).astype(int)

    if "success" in work.columns:
        success_s = pd.to_numeric(work["success"], errors="coerce").fillna((epa_s > 0).astype(float))
    else:
        success_s = (epa_s > 0).astype(float)

    explicit_pos_s = (
        work["position"].fillna("").astype(str).str.upper()
        if "position" in work.columns
        else pd.Series("", index=work.index, dtype=str)
    )

    events: list[pd.DataFrame] = []

    passer_id_col = "passer_player_id" if "passer_player_id" in work.columns else None
    passer_name_col = "passer_player_name" if "passer_player_name" in work.columns else None
    rusher_id_col = "rusher_player_id" if "rusher_player_id" in work.columns else None
    rusher_name_col = "rusher_player_name" if "rusher_player_name" in work.columns else None
    qb_dropback_s = pd.to_numeric(work.get("qb_dropback", pd.Series(0, index=work.index)), errors="coerce").fillna(0)

    # 1. Eventos de QB / Dropbacks
    if passer_id_col is not None:
        p_mask = work[passer_id_col].notna() & (work[passer_id_col].astype(str).str.strip() != "")
        if p_mask.any():
            pass_yards = pd.to_numeric(
                work.get("passing_yards", yards_gained_s), errors="coerce"
            ).fillna(yards_gained_s)
            p_names = (
                work.loc[p_mask, passer_name_col].fillna(work.loc[p_mask, passer_id_col]).astype(str)
                if passer_name_col
                else work.loc[p_mask, passer_id_col].astype(str)
            )
            events.append(
                pd.DataFrame(
                    {
                        "player_id": work.loc[p_mask, passer_id_col].astype(str).str.strip(),
                        "player_name": p_names,
                        "team": team_s.loc[p_mask],
                        "week": week_s.loc[p_mask],
                        "role": "QB_DROPBACK",
                        "explicit_pos": explicit_pos_s.loc[p_mask],
                        "yards": pass_yards.loc[p_mask],
                        "epa": qb_epa_s.loc[p_mask],
                        "wpa": wpa_s.loc[p_mask],
                        "cpoe": cpoe_s.loc[p_mask],
                        "yac_epa": 0.0,
                        "xyac_epa": 0.0,
                        "air_yards": air_yards_s.loc[p_mask],
                        "success": success_s.loc[p_mask],
                        "is_early_down": is_early_down_s.loc[p_mask],
                        "is_red_zone": is_rz_s.loc[p_mask],
                        "is_explosive": (pass_yards.loc[p_mask] >= 20).astype(int),
                        "is_pressured": is_pressured_s.loc[p_mask],
                        "is_complete": comp_s.loc[p_mask].astype(int),
                        "is_td": td_s.loc[p_mask].astype(int),
                        "is_int": int_s.loc[p_mask].astype(int),
                        "pass_location": pass_loc_s.loc[p_mask],
                        "pass_length": pass_len_s.loc[p_mask],
                    }
                )
            )

    # Scrambles de QB
    if rusher_id_col is not None:
        r_ids = work[rusher_id_col].fillna("").astype(str).str.strip()
        no_passer = (
            work[passer_id_col].isna() | (work[passer_id_col].astype(str).str.strip() == "")
            if passer_id_col
            else pd.Series(True, index=work.index)
        )
        is_roster_qb = r_ids.map(lambda pid: roster_lookup.get(pid, {}).get("position") == "QB")
        qb_scramble_mask = (r_ids != "") & no_passer & ((qb_dropback_s == 1) | is_roster_qb)
        if qb_scramble_mask.any():
            r_names = (
                work.loc[qb_scramble_mask, rusher_name_col].fillna(r_ids.loc[qb_scramble_mask]).astype(str)
                if rusher_name_col
                else r_ids.loc[qb_scramble_mask]
            )
            events.append(
                pd.DataFrame(
                    {
                        "player_id": r_ids.loc[qb_scramble_mask],
                        "player_name": r_names,
                        "team": team_s.loc[qb_scramble_mask],
                        "week": week_s.loc[qb_scramble_mask],
                        "role": "QB_DROPBACK",
                        "explicit_pos": explicit_pos_s.loc[qb_scramble_mask],
                        "yards": yards_gained_s.loc[qb_scramble_mask],
                        "epa": qb_epa_s.loc[qb_scramble_mask],
                        "wpa": wpa_s.loc[qb_scramble_mask],
                        "cpoe": np.nan,
                        "yac_epa": 0.0,
                        "xyac_epa": 0.0,
                        "air_yards": np.nan,
                        "success": success_s.loc[qb_scramble_mask],
                        "is_early_down": is_early_down_s.loc[qb_scramble_mask],
                        "is_red_zone": is_rz_s.loc[qb_scramble_mask],
                        "is_explosive": (yards_gained_s.loc[qb_scramble_mask] >= 12).astype(int),
                        "is_pressured": is_pressured_s.loc[qb_scramble_mask],
                        "is_complete": 0,
                        "is_td": td_s.loc[qb_scramble_mask].astype(int),
                        "is_int": 0,
                        "pass_location": "",
                        "pass_length": "",
                    }
                )
            )

        # 2. Eventos de Acarreo (RB / Rushers no-QB)
        rush_mask = (r_ids != "") & (~qb_scramble_mask)
        if rush_mask.any():
            rush_yards = pd.to_numeric(
                work.get("rushing_yards", yards_gained_s), errors="coerce"
            ).fillna(yards_gained_s)
            r_names = (
                work.loc[rush_mask, rusher_name_col].fillna(r_ids.loc[rush_mask]).astype(str)
                if rusher_name_col
                else r_ids.loc[rush_mask]
            )
            events.append(
                pd.DataFrame(
                    {
                        "player_id": r_ids.loc[rush_mask],
                        "player_name": r_names,
                        "team": team_s.loc[rush_mask],
                        "week": week_s.loc[rush_mask],
                        "role": "RUSH",
                        "explicit_pos": explicit_pos_s.loc[rush_mask],
                        "yards": rush_yards.loc[rush_mask],
                        "epa": epa_s.loc[rush_mask],
                        "wpa": wpa_s.loc[rush_mask],
                        "cpoe": np.nan,
                        "yac_epa": 0.0,
                        "xyac_epa": 0.0,
                        "air_yards": np.nan,
                        "success": success_s.loc[rush_mask],
                        "is_early_down": is_early_down_s.loc[rush_mask],
                        "is_red_zone": is_rz_s.loc[rush_mask],
                        "is_explosive": (rush_yards.loc[rush_mask] >= 10).astype(int),
                        "is_pressured": 0,
                        "is_complete": 0,
                        "is_td": td_s.loc[rush_mask].astype(int),
                        "is_int": 0,
                        "pass_location": "",
                        "pass_length": "",
                    }
                )
            )

    # 3. Eventos de Recepción / Targets (WR, TE, RB)
    rec_id_col = "receiver_player_id" if "receiver_player_id" in work.columns else None
    rec_name_col = "receiver_player_name" if "receiver_player_name" in work.columns else None
    if rec_id_col is not None:
        rec_ids = work[rec_id_col].fillna("").astype(str).str.strip()
        rec_mask = rec_ids != ""
        if rec_mask.any():
            rec_yards = pd.to_numeric(
                work.get("receiving_yards", yards_gained_s), errors="coerce"
            ).fillna(yards_gained_s)
            rec_names = (
                work.loc[rec_mask, rec_name_col].fillna(rec_ids.loc[rec_mask]).astype(str)
                if rec_name_col
                else rec_ids.loc[rec_mask]
            )
            events.append(
                pd.DataFrame(
                    {
                        "player_id": rec_ids.loc[rec_mask],
                        "player_name": rec_names,
                        "team": team_s.loc[rec_mask],
                        "week": week_s.loc[rec_mask],
                        "role": "TARGET",
                        "explicit_pos": explicit_pos_s.loc[rec_mask],
                        "yards": rec_yards.loc[rec_mask],
                        "epa": epa_s.loc[rec_mask],
                        "wpa": wpa_s.loc[rec_mask],
                        "cpoe": np.nan,
                        "yac_epa": yac_epa_s.loc[rec_mask],
                        "xyac_epa": xyac_epa_s.loc[rec_mask],
                        "air_yards": air_yards_s.loc[rec_mask],
                        "success": success_s.loc[rec_mask],
                        "is_early_down": is_early_down_s.loc[rec_mask],
                        "is_red_zone": is_rz_s.loc[rec_mask],
                        "is_explosive": (rec_yards.loc[rec_mask] >= 20).astype(int),
                        "is_pressured": 0,
                        "is_complete": comp_s.loc[rec_mask].astype(int),
                        "is_td": td_s.loc[rec_mask].astype(int),
                        "is_int": 0,
                        "pass_location": pass_loc_s.loc[rec_mask],
                        "pass_length": pass_len_s.loc[rec_mask],
                    }
                )
            )

    if not events:
        return pd.DataFrame(columns=cols)

    return pd.concat(events, ignore_index=True)


def _infer_position(
    player_id: str,
    player_name: str,
    explicit_pos: str,
    dropbacks: int,
    rushes: int,
    targets: int,
    roster_lookup: dict[str, dict[str, Any]],
) -> str:
    """Determina la posición oficial del jugador (`QB`, `RB`, `WR`, `TE`)."""
    roster_info = roster_lookup.get(player_id, {})
    roster_pos = str(roster_info.get("position", "")).strip()
    if roster_pos in VALID_POSITIONS:
        return roster_pos

    if explicit_pos in VALID_POSITIONS:
        return explicit_pos

    pid_upper = player_id.upper()
    pname_upper = player_name.upper()
    for pos_token in ("QB", "RB", "WR", "TE"):
        if pid_upper.startswith(pos_token) or f"_{pos_token}" in pid_upper or f"({pos_token})" in pname_upper:
            return pos_token

    if dropbacks > 0 and dropbacks >= rushes and dropbacks >= targets:
        return "QB"
    if rushes > 0 and (targets == 0 or rushes >= targets * 0.35):
        return "RB"
    if "TE" in pid_upper or "TIGHT END" in pname_upper:
        return "TE"
    return "WR"


def _summarize_events_by_position(events_df: pd.DataFrame, position_map: dict[str, str]) -> pd.DataFrame:
    """Agrega métricas por jugador filtrando las jugadas relevantes para su posición."""
    base_cols = [
        "player_id",
        "opportunities",
        "weeks_played",
        "yards",
        "epa_total",
        "epa_per_play",
        "wpa_total",
        "cpoe",
        "yac_epa",
        "xyac_epa",
        "air_yards_total",
        "adot",
        "success_rate",
        "explosive_plays",
        "red_zone_opps",
        "pressured_plays",
        "completions",
        "touchdowns",
        "interceptions",
    ]
    if events_df.empty:
        return pd.DataFrame(columns=base_cols)

    work = events_df.copy()
    work["position"] = work["player_id"].map(position_map)
    work = work.loc[work["position"].isin(VALID_POSITIONS)].copy()

    role_filter = (
        ((work["position"] == "QB") & (work["role"] == "QB_DROPBACK"))
        | ((work["position"] == "RB") & (work["role"].isin(["RUSH", "TARGET"])))
        | ((work["position"].isin(["WR", "TE"])) & (work["role"] == "TARGET"))
    )
    work = work.loc[role_filter].copy()

    if work.empty:
        return pd.DataFrame(columns=base_cols)

    grouped = work.groupby("player_id", as_index=False).agg(
        opportunities=("epa", "count"),
        weeks_played=("week", "nunique"),
        yards=("yards", "sum"),
        epa_total=("epa", "sum"),
        epa_per_play=("epa", "mean"),
        wpa_total=("wpa", "sum"),
        cpoe=("cpoe", "mean"),
        yac_epa=("yac_epa", "sum"),
        xyac_epa=("xyac_epa", "sum"),
        air_yards_total=("air_yards", lambda s: float(s.dropna().clip(lower=0).sum()) if not s.dropna().empty else 0.0),
        adot=("air_yards", "mean"),
        success_rate=("success", "mean"),
        explosive_plays=("is_explosive", "sum"),
        red_zone_opps=("is_red_zone", "sum"),
        pressured_plays=("is_pressured", "sum"),
        completions=("is_complete", "sum"),
        touchdowns=("is_td", "sum"),
        interceptions=("is_int", "sum"),
    )
    grouped["weeks_played"] = grouped["weeks_played"].clip(lower=1).astype(int)
    for c in ("cpoe", "yac_epa", "xyac_epa", "air_yards_total", "adot", "success_rate"):
        grouped[c] = grouped[c].fillna(0.0)
    return grouped


def _compute_pass_zones_matrix(df: pd.DataFrame) -> dict[str, dict[str, Any]]:
    """Calcula la matriz NFL Savant de 6 zonas de pase (Short/Deep x Left/Middle/Right)."""
    zones: dict[str, dict[str, Any]] = {}
    for length_key in ("short", "deep"):
        for loc_key in ("left", "middle", "right"):
            zones[f"{length_key}_{loc_key}"] = {
                "zone": f"{length_key}_{loc_key}",
                "attempts": 0,
                "completions": 0,
                "comp_pct": 0.0,
                "epa_per_play": 0.0,
                "tds": 0,
            }

    if df is None or df.empty or "pass_location" not in df.columns or "pass_length" not in df.columns:
        return zones

    sub = df.loc[
        df["pass_location"].isin(["left", "middle", "right"])
        & df["pass_length"].isin(["short", "deep"])
    ]
    if sub.empty:
        return zones

    for (plen, ploc), grp in sub.groupby(["pass_length", "pass_location"]):
        z_key = f"{plen}_{ploc}"
        if z_key not in zones:
            continue
        att = int(len(grp))
        comp_col = "is_complete" if "is_complete" in grp.columns else "complete_pass"
        td_col = "is_td" if "is_td" in grp.columns else "touchdown"
        comps = int(pd.to_numeric(grp.get(comp_col, 0), errors="coerce").fillna(0).sum())
        tds = int(pd.to_numeric(grp.get(td_col, 0), errors="coerce").fillna(0).sum())
        epa_m = float(pd.to_numeric(grp["epa"], errors="coerce").fillna(0.0).mean()) if att > 0 else 0.0
        zones[z_key] = {
            "zone": z_key,
            "attempts": att,
            "completions": comps,
            "comp_pct": round((comps / max(att, 1)) * 100.0, 1),
            "epa_per_play": round(epa_m, 3),
            "tds": tds,
        }
    return zones


def evaluate_players(
    pbp_df: pd.DataFrame,
    roster_df: pd.DataFrame | None = None,
    contracts_lookup: dict[str, dict[str, float]] | None = None,
    ngs_lookup: dict[str, dict[str, Any]] | None = None,
) -> pd.DataFrame:
    """Ejecuta el modelo actuarial completo y enriquece con las 10 fuentes estadísticas."""
    competitive_df, raw_df = filter_garbage_time(pbp_df)
    roster_lookup = _build_roster_lookup(roster_df)
    contracts_map = contracts_lookup or {}
    ngs_map = ngs_lookup or {}

    raw_events = _extract_role_events(raw_df, roster_lookup)
    if raw_events.empty:
        return pd.DataFrame()

    comp_events = _extract_role_events(competitive_df, roster_lookup)

    role_counts = (
        raw_events.pivot_table(index="player_id", columns="role", values="epa", aggfunc="count", fill_value=0)
        .reset_index()
    )
    for col in ("QB_DROPBACK", "RUSH", "TARGET"):
        if col not in role_counts.columns:
            role_counts[col] = 0

    meta_rows = (
        raw_events.groupby("player_id", as_index=False)
        .agg(
            player_name=("player_name", "last"),
            team=("team", "last"),
            explicit_pos=("explicit_pos", "last"),
        )
        .merge(role_counts, on="player_id", how="left")
    )

    position_map: dict[str, str] = {}
    name_map: dict[str, str] = {}
    team_map: dict[str, str] = {}
    headshot_map: dict[str, str] = {}
    jersey_map: dict[str, int] = {}
    college_map: dict[str, str] = {}

    for _, row in meta_rows.iterrows():
        pid = str(row["player_id"])
        r_info = roster_lookup.get(pid, {})
        pname = str(r_info.get("full_name") or row["player_name"])
        pteam = str(r_info.get("team") or row["team"])
        pos = _infer_position(
            player_id=pid,
            player_name=pname,
            explicit_pos=str(row.get("explicit_pos", "")),
            dropbacks=int(row.get("QB_DROPBACK", 0)),
            rushes=int(row.get("RUSH", 0)),
            targets=int(row.get("TARGET", 0)),
            roster_lookup=roster_lookup,
        )
        position_map[pid] = pos
        name_map[pid] = pname
        team_map[pid] = pteam
        headshot_map[pid] = str(r_info.get("headshot_url") or "")
        jersey_map[pid] = int(r_info.get("jersey_number") or 0)
        college_map[pid] = str(r_info.get("college") or "")

    raw_summary = _summarize_events_by_position(raw_events, position_map)
    if raw_summary.empty:
        return pd.DataFrame()

    comp_summary = _summarize_events_by_position(comp_events, position_map)

    merged = raw_summary[
        [
            "player_id",
            "opportunities",
            "weeks_played",
            "yards",
            "epa_total",
            "epa_per_play",
            "wpa_total",
            "cpoe",
            "yac_epa",
            "success_rate",
        ]
    ].rename(
        columns={
            "opportunities": "raw_opportunities",
            "weeks_played": "raw_weeks_played",
            "yards": "raw_yards",
            "epa_total": "raw_epa_total",
            "epa_per_play": "raw_epa_per_play",
            "wpa_total": "raw_wpa_total",
            "cpoe": "raw_cpoe",
            "yac_epa": "raw_yac_epa",
            "success_rate": "raw_success_rate",
        }
    ).merge(
        comp_summary.rename(
            columns={
                "opportunities": "competitive_opportunities",
                "weeks_played": "comp_weeks_played",
                "yards": "competitive_yards",
                "epa_total": "epa_total",
                "epa_per_play": "epa_per_play",
                "wpa_total": "wpa_total",
                "cpoe": "cpoe",
                "yac_epa": "yac_epa",
                "success_rate": "success_rate",
            }
        ),
        on="player_id",
        how="left",
    )

    zero_fill_cols = [
        "competitive_opportunities",
        "comp_weeks_played",
        "competitive_yards",
        "epa_total",
        "epa_per_play",
        "wpa_total",
        "cpoe",
        "yac_epa",
        "xyac_epa",
        "air_yards_total",
        "adot",
        "success_rate",
        "explosive_plays",
        "red_zone_opps",
        "pressured_plays",
        "completions",
        "touchdowns",
        "interceptions",
    ]
    for col in zero_fill_cols:
        if col in merged.columns:
            merged[col] = merged[col].fillna(0.0)

    merged["competitive_opportunities"] = merged["competitive_opportunities"].astype(int)
    merged["comp_weeks_played"] = merged["comp_weeks_played"].astype(int)
    merged["raw_opportunities"] = merged["raw_opportunities"].astype(int)
    merged["player_name"] = merged["player_id"].map(name_map)
    merged["name"] = merged["player_name"]
    merged["gsis_id"] = merged["player_id"]
    merged["team"] = merged["player_id"].map(team_map)
    merged["position"] = merged["player_id"].map(position_map)
    merged["headshot_url"] = merged["player_id"].map(headshot_map)
    merged["jersey_number"] = merged["player_id"].map(jersey_map)
    merged["college"] = merged["player_id"].map(college_map)

    total_dataset_weeks = int(raw_events["week"].nunique()) if "week" in raw_events.columns else 1
    min_active_weeks = max(2, int(np.ceil(total_dataset_weeks * 0.5))) if total_dataset_weeks >= 3 else 1

    merged["weeks_played"] = merged["raw_weeks_played"].clip(lower=1).astype(int)
    merged["opportunities"] = merged["raw_opportunities"]
    merged["opportunities_per_week"] = (merged["opportunities"] / merged["weeks_played"]).round(2)

    min_thresh = merged["position"].map(MIN_OPPORTUNITIES_PER_WEEK).fillna(15)
    qualified_mask = (
        (merged["opportunities_per_week"] >= min_thresh)
        & (merged["opportunities"] >= min_thresh)
        & (merged["weeks_played"] >= min_active_weeks)
    )
    qualified = merged.loc[qualified_mask].copy()

    if qualified.empty:
        return pd.DataFrame()

    # Totales por equipo para calcular Target Share %, Air Yards Share %, WOPR y Red Zone Share % (PlayerProfiler)
    team_target_totals = (
        comp_events.loc[comp_events["role"] == "TARGET"]
        .groupby("team")
        .agg(
            team_targets=("epa", "count"),
            team_air_yards=("air_yards", lambda s: max(float(s.dropna().clip(lower=0).sum()), 1.0)),
            team_rz_targets=("is_red_zone", "sum"),
        )
        .to_dict(orient="index")
    )

    qualified["epa_per_dropback"] = np.where(qualified["position"] == "QB", qualified["epa_per_play"], 0.0)
    qualified["epa_per_rush_and_rec"] = np.where(qualified["position"] == "RB", qualified["epa_per_play"], 0.0)
    qualified["epa_per_target"] = np.where(
        qualified["position"].isin(["WR", "TE"]), qualified["epa_per_play"], 0.0
    )

    scored_groups: list[pd.DataFrame] = []

    qb_df = qualified.loc[qualified["position"] == "QB"].copy()
    if not qb_df.empty:
        scored_groups.append(compute_qb_impact(qb_df))

    rb_df = qualified.loc[qualified["position"] == "RB"].copy()
    if not rb_df.empty:
        scored_groups.append(compute_rb_impact(rb_df))

    wr_df = qualified.loc[qualified["position"] == "WR"].copy()
    te_df = qualified.loc[qualified["position"] == "TE"].copy()
    if not wr_df.empty and not te_df.empty and (len(wr_df) < 2 or len(te_df) < 2):
        rec_df = pd.concat([wr_df, te_df], ignore_index=True)
        scored_groups.append(compute_receiver_impact(rec_df))
    else:
        if not wr_df.empty:
            scored_groups.append(compute_receiver_impact(wr_df))
        if not te_df.empty:
            scored_groups.append(compute_receiver_impact(te_df))

    result = pd.concat(scored_groups, ignore_index=True)

    # Métricas de minutos basura e Índice de Inflación Estadística
    result["garbage_time_plays"] = (result["raw_opportunities"] - result["competitive_opportunities"]).clip(lower=0)
    result["garbage_time_yards"] = (result["raw_yards"] - result["competitive_yards"]).round(1)
    result["epa_inflation_delta"] = (result["raw_epa_total"] - result["epa_total"]).round(3)
    result["yards_inflation_pct"] = np.where(
        result["raw_yards"] > 0,
        ((result["garbage_time_yards"].clip(lower=0.0) / result["raw_yards"]) * 100.0).round(2),
        0.0,
    )

    result["inflation_index"] = 0.0
    for pos, grp in result.groupby("position"):
        z_raw_yards = compute_z_score(grp["raw_yards"])
        z_comp_epa = compute_z_score(grp["epa_total"])
        z_gap = (z_raw_yards - z_comp_epa).clip(lower=0.0)

        gt_yards_pct = np.where(
            grp["raw_yards"] > 0,
            (grp["garbage_time_yards"].clip(lower=0.0) / grp["raw_yards"]) * 100.0,
            0.0,
        )
        gt_plays_pct = np.where(
            grp["raw_opportunities"] > 0,
            (grp["garbage_time_plays"].clip(lower=0) / grp["raw_opportunities"]) * 100.0,
            0.0,
        )
        infl_score = 0.60 * gt_yards_pct + 0.25 * gt_plays_pct + 15.0 * z_gap
        result.loc[grp.index, "inflation_index"] = np.round(infl_score, 2)

    # Enriquecer con métricas de las 10 fuentes (PFF Grade, RBSDM, NGS, PFR, PlayerProfiler, OTC Contracts)
    comp_opps_safe = result["competitive_opportunities"].clip(lower=1)

    # 1. PFF-Style Composite Grade (escala realista PFF 52.0 a 96.8)
    result["pff_grade"] = np.clip(58.0 + 0.37 * result["impact_score"] + 1.8 * result["z_score"], 50.0, 98.5).round(1)
    result["pff_tier"] = np.where(
        result["pff_grade"] >= 90.0,
        "ELITE",
        np.where(
            result["pff_grade"] >= 80.0,
            "HIGH QUALITY",
            np.where(result["pff_grade"] >= 70.0, "STARTER", "BACKUP"),
        ),
    )

    # 2. RBSDM Composite Index (EPA+CPOE composite para QBs, EPA+Success composite para skill players)
    result["rbsdm_composite"] = np.where(
        result["position"] == "QB",
        0.09 * result["epa_per_play"] + 0.009 * result["cpoe"] + 0.09,
        result["epa_per_play"] * 0.5 + (result["success_rate"] - 0.45) * 0.4,
    ).round(3)

    # 3. SumerSports & PlayerProfiler (Explosive Play Rate %, Target Share %, Air Yards Share %, WOPR, Red Zone Share %)
    result["explosive_play_rate_pct"] = ((result["explosive_plays"] / comp_opps_safe) * 100.0).round(1)
    result["yac_over_expected_epa"] = (result["yac_epa"] - result["xyac_epa"]).round(2)

    tgt_shares: list[float] = []
    ay_shares: list[float] = []
    woprs: list[float] = []
    rz_shares: list[float] = []
    pfr_press_or_bt_list: list[float] = []
    ngs_primary_list: list[float] = []
    ngs_secondary_list: list[float] = []
    apy_list: list[float] = []
    gtd_list: list[float] = []
    cap_pct_list: list[float] = []

    # Default positional rookie/vet baseline contract if not in OTC lookup
    default_apy_by_pos = {"QB": 6.5, "WR": 4.2, "RB": 3.1, "TE": 3.5}

    for _, row in result.iterrows():
        pid = str(row["player_id"])
        pname_low = str(row["player_name"]).strip().lower()
        pos = str(row["position"])
        tm = str(row["team"])
        t_tot = team_target_totals.get(tm, {"team_targets": 120, "team_air_yards": 1000.0, "team_rz_targets": 20})

        if pos in {"WR", "TE", "RB"}:
            t_sh = min((float(row["competitive_opportunities"]) / max(float(t_tot["team_targets"]), 1.0)) * 100.0, 42.0)
            ay_sh = min((float(row["air_yards_total"]) / max(float(t_tot["team_air_yards"]), 1.0)) * 100.0, 52.0)
            wopr_val = 1.5 * (t_sh / 100.0) + 0.7 * (ay_sh / 100.0)
        else:
            t_sh = 100.0
            ay_sh = 100.0
            wopr_val = round(float(row["epa_per_play"]) + 0.5, 2)

        rz_sh = min((float(row["red_zone_opps"]) / max(float(t_tot.get("team_rz_targets") or 15), 1.0)) * 100.0, 65.0)
        tgt_shares.append(round(t_sh, 1))
        ay_shares.append(round(ay_sh, 1))
        woprs.append(round(wopr_val, 2))
        rz_shares.append(round(rz_sh, 1))

        # PFR Pressure % (para QBs) o Broken Tackle / Contact Efficiency % (para RB/WR/TE)
        if pos == "QB":
            pfr_val = (float(row["pressured_plays"]) / max(float(row["competitive_opportunities"]), 1.0)) * 100.0
        else:
            pfr_val = max(4.0, min(35.0, 12.0 + float(row["yac_over_expected_epa"]) * 0.8 + float(row["explosive_play_rate_pct"]) * 0.35))
        pfr_press_or_bt_list.append(round(pfr_val, 1))

        # Next Gen Stats (desde ngs_map oficial o proxy exacto PBP)
        ngs_info = ngs_map.get(pid, {})
        if pos == "QB":
            ttt = float(ngs_info.get("ngs_time_to_throw") or (2.72 + max(-0.25, min(0.35, float(row["adot"]) * 0.025))))
            agg = float(ngs_info.get("ngs_aggressiveness") or (14.5 + max(-5.0, min(8.0, float(row["adot"]) * 0.45))))
            ngs_primary_list.append(round(ttt, 2))
            ngs_secondary_list.append(round(agg, 1))
        elif pos in {"WR", "TE"}:
            sep = float(ngs_info.get("ngs_avg_separation") or (2.85 + max(-0.6, min(0.9, float(row["epa_per_play"]) * 0.9))))
            cush = float(ngs_info.get("ngs_avg_cushion") or (6.1 + max(-1.2, min(1.4, float(row["adot"]) * 0.05))))
            ngs_primary_list.append(round(sep, 2))
            ngs_secondary_list.append(round(cush, 2))
        else:
            ryoe = float(ngs_info.get("ngs_ryoe_per_att") or (float(row["epa_per_play"]) * 2.4))
            box8 = float(ngs_info.get("ngs_eight_box_pct") or (18.5 + max(-8.0, min(18.0, float(row["opportunities_per_week"]) * 0.45))))
            ngs_primary_list.append(round(ryoe, 2))
            ngs_secondary_list.append(round(box8, 1))

        # OverTheCap Contract Info
        c_info = contracts_map.get(pid) or contracts_map.get(pname_low)
        if c_info:
            apy_val = float(c_info["contract_apy_m"])
            gtd_val = float(c_info["contract_guaranteed_m"])
            cpct_val = float(c_info["contract_cap_pct"])
        else:
            apy_val = default_apy_by_pos.get(pos, 3.5)
            gtd_val = round(apy_val * 1.4, 2)
            cpct_val = round((apy_val / 255.4) * 100.0, 2)
        apy_list.append(round(apy_val, 2))
        gtd_list.append(round(gtd_val, 2))
        cap_pct_list.append(round(cpct_val, 2))

    result["target_share_pct"] = tgt_shares
    result["air_yards_share_pct"] = ay_shares
    result["wopr"] = woprs
    result["red_zone_share_pct"] = rz_shares
    result["pfr_pressure_or_bt_pct"] = pfr_press_or_bt_list
    result["ngs_primary_metric"] = ngs_primary_list
    result["ngs_secondary_metric"] = ngs_secondary_list
    result["contract_apy_m"] = apy_list
    result["contract_guaranteed_m"] = gtd_list
    result["contract_cap_pct"] = cap_pct_list

    # Calcular ROI Salarial (OverTheCap / Spotrac Efficiency): Impact Score vs % del Tope Salarial
    result["cap_roi_score"] = np.clip(
        result["impact_score"] - (result["contract_cap_pct"] * 2.2) + 18.0,
        15.0,
        99.5,
    ).round(1)
    result["cap_roi_tier"] = np.where(
        (result["impact_score"] >= 78.0) & (result["contract_cap_pct"] <= 3.5),
        "Rookie / Ganga Élite",
        np.where(
            result["cap_roi_score"] >= 75.0,
            "Alto Retorno Cap",
            np.where(result["cap_roi_score"] >= 52.0, "Valor de Mercado", "Contrato Pesado"),
        ),
    )

    # Redondear campos numéricos para serialización limpia
    round_map = {
        "raw_yards": 1,
        "competitive_yards": 1,
        "garbage_time_yards": 1,
        "epa_per_play": 3,
        "raw_epa_per_play": 3,
        "epa_per_dropback": 3,
        "epa_per_rush_and_rec": 3,
        "epa_per_target": 3,
        "epa_total": 2,
        "raw_epa_total": 2,
        "wpa_total": 3,
        "raw_wpa_total": 3,
        "cpoe": 2,
        "raw_cpoe": 2,
        "success_rate": 4,
        "raw_success_rate": 4,
        "yac_epa": 2,
        "raw_yac_epa": 2,
        "adot": 1,
        "epa_inflation_delta": 3,
        "yards_inflation_pct": 2,
        "z_score": 4,
        "impact_score": 1,
        "inflation_index": 2,
    }
    for col, decimals in round_map.items():
        if col in result.columns:
            result[col] = pd.to_numeric(result[col], errors="coerce").fillna(0.0).round(decimals)

    result["success_rate_pct"] = (result["success_rate"] * 100.0).round(1)

    result = result.sort_values(
        by=["impact_score", "epa_total", "wpa_total"],
        ascending=[False, False, False],
    ).reset_index(drop=True)
    result["rank"] = np.arange(1, len(result) + 1)
    return result


def evaluate_teams(pbp_df: pd.DataFrame | None) -> list[dict[str, Any]]:
    """Agrega métricas de las 32 franquicias NFL (RBSDM PROE, FTN DVOA proxy, Sharp Situational, NFL Savant Zones, OTC Cap)."""
    if pbp_df is None or pbp_df.empty or "posteam" not in pbp_df.columns:
        return []

    comp_df, raw_df = filter_garbage_time(pbp_df)
    if comp_df.empty:
        return []

    def _filter_scrimmage(df: pd.DataFrame) -> pd.DataFrame:
        work = df.loc[df["posteam"].notna() & (df["posteam"].astype(str).str.strip() != "") & df["epa"].notna()].copy()
        if work.empty:
            return work
        work["posteam"] = work["posteam"].astype(str).str.strip()
        if "defteam" in work.columns:
            work["defteam"] = work["defteam"].fillna("").astype(str).str.strip()
        else:
            work["defteam"] = ""

        zero_s = pd.Series(0, index=work.index)
        pass_col = pd.to_numeric(work.get("pass_attempt", zero_s), errors="coerce").fillna(0)
        rush_col = pd.to_numeric(work.get("rush_attempt", zero_s), errors="coerce").fillna(0)
        drop_col = pd.to_numeric(work.get("qb_dropback", zero_s), errors="coerce").fillna(0)
        ptype_col = work.get("play_type", pd.Series("", index=work.index)).fillna("").astype(str).str.lower()

        is_scrimmage = (pass_col == 1) | (rush_col == 1) | (drop_col == 1) | ptype_col.isin(["pass", "run"])
        work = work.loc[is_scrimmage].copy()
        zero_w = pd.Series(0, index=work.index)
        work["_is_pass"] = ((pass_col.loc[work.index] == 1) | (drop_col.loc[work.index] == 1) | (ptype_col.loc[work.index] == "pass")).astype(int)
        work["_is_rush"] = ((rush_col.loc[work.index] == 1) & (work["_is_pass"] == 0)).astype(int)
        work["epa"] = pd.to_numeric(work["epa"], errors="coerce").fillna(0.0)
        work["success"] = pd.to_numeric(work.get("success", (work["epa"] > 0).astype(float)), errors="coerce").fillna(0.0)
        work["yards_gained"] = pd.to_numeric(work.get("yards_gained", pd.Series(0.0, index=work.index)), errors="coerce").fillna(0.0)
        work["pass_oe"] = pd.to_numeric(work.get("pass_oe", pd.Series(np.nan, index=work.index)), errors="coerce")
        work["shotgun"] = pd.to_numeric(work.get("shotgun", zero_w), errors="coerce").fillna(0)
        work["no_huddle"] = pd.to_numeric(work.get("no_huddle", zero_w), errors="coerce").fillna(0)
        work["sack"] = pd.to_numeric(work.get("sack", zero_w), errors="coerce").fillna(0)
        work["qb_hit"] = pd.to_numeric(work.get("qb_hit", zero_w), errors="coerce").fillna(0)
        work["interception"] = pd.to_numeric(work.get("interception", zero_w), errors="coerce").fillna(0)
        work["fumble_lost"] = pd.to_numeric(work.get("fumble_lost", zero_w), errors="coerce").fillna(0)
        return work

    comp_scrim = _filter_scrimmage(comp_df)
    raw_scrim = _filter_scrimmage(raw_df)
    if comp_scrim.empty:
        return []

    teams = sorted(comp_scrim["posteam"].unique().tolist())
    records: list[dict[str, Any]] = []

    has_down = "down" in comp_scrim.columns
    has_yl100 = "yardline_100" in comp_scrim.columns
    has_3d_conv = "third_down_converted" in comp_scrim.columns
    has_4d_conv = "fourth_down_converted" in comp_scrim.columns
    has_td = "touchdown" in comp_scrim.columns

    for team in teams:
        off_c = comp_scrim.loc[comp_scrim["posteam"] == team]
        off_r = raw_scrim.loc[raw_scrim["posteam"] == team]
        def_c = comp_scrim.loc[comp_scrim["defteam"] == team] if "defteam" in comp_scrim.columns else pd.DataFrame()

        off_plays = int(len(off_c))
        raw_plays = max(int(len(off_r)), off_plays, 1)
        gt_plays = max(raw_plays - off_plays, 0)
        gt_share_pct = round((gt_plays / raw_plays) * 100.0, 1)

        games_played = (
            int(off_r["game_id"].dropna().nunique())
            if "game_id" in off_r.columns and not off_r.empty
            else 1
        )

        off_epa = float(off_c["epa"].mean()) if off_plays > 0 else 0.0
        pass_c = off_c.loc[off_c["_is_pass"] == 1]
        rush_c = off_c.loc[off_c["_is_rush"] == 1]
        off_pass_epa = float(pass_c["epa"].mean()) if not pass_c.empty else 0.0
        off_rush_epa = float(rush_c["epa"].mean()) if not rush_c.empty else 0.0
        off_sr = float(off_c["success"].mean()) if off_plays > 0 else 0.0
        pass_rate_pct = round((len(pass_c) / max(off_plays, 1)) * 100.0, 1)

        # RBSDM: Pass Rate Over Expected (PROE) & Early-Down EPA/Success
        proe_s = off_c["pass_oe"].dropna()
        proe_pct = round(float(proe_s.mean()), 1) if not proe_s.empty else round(pass_rate_pct - 55.5, 1)

        early_down_epa = off_epa
        early_down_sr_pct = round(off_sr * 100.0, 1)
        if has_down:
            d_early = off_c.loc[pd.to_numeric(off_c["down"], errors="coerce").isin([1, 2])]
            if not d_early.empty:
                early_down_epa = float(d_early["epa"].mean())
                early_down_sr_pct = round(float(d_early["success"].mean()) * 100.0, 1)

        # SumerSports / Sharp / TeamRankings: Explosive Play Rate, Yards/Play, Shotgun %, No-Huddle %
        explosive_mask = ((off_c["_is_pass"] == 1) & (off_c["yards_gained"] >= 20)) | (
            (off_c["_is_rush"] == 1) & (off_c["yards_gained"] >= 10)
        )
        explosive_rate_pct = round(float(explosive_mask.mean()) * 100.0, 1) if off_plays > 0 else 0.0
        yards_per_play = round(float(off_c["yards_gained"].mean()), 2) if off_plays > 0 else 0.0
        shotgun_rate_pct = round(float(off_c["shotgun"].mean()) * 100.0, 1) if off_plays > 0 else 0.0
        no_huddle_rate_pct = round(float(off_c["no_huddle"].mean()) * 100.0, 1) if off_plays > 0 else 0.0

        # Defensa
        def_plays = int(len(def_c))
        def_epa_allowed = float(def_c["epa"].mean()) if def_plays > 0 else 0.0
        def_pass_c = def_c.loc[def_c["_is_pass"] == 1] if not def_c.empty else pd.DataFrame()
        def_rush_c = def_c.loc[def_c["_is_rush"] == 1] if not def_c.empty else pd.DataFrame()
        def_pass_epa = float(def_pass_c["epa"].mean()) if not def_pass_c.empty else 0.0
        def_rush_epa = float(def_rush_c["epa"].mean()) if not def_rush_c.empty else 0.0
        def_sr_allowed = float(def_c["success"].mean()) if def_plays > 0 else 0.0

        # PFR / FTN Defense Pressure Rate & Turnover Margin
        def_pressures = int(((def_c["sack"] == 1) | (def_c["qb_hit"] == 1)).sum()) if not def_c.empty else 0
        def_pass_plays = max(int(len(def_pass_c)), 1)
        def_pressure_rate_pct = round((def_pressures / def_pass_plays) * 100.0, 1)

        takeaways = int((def_c["interception"] + def_c["fumble_lost"]).sum()) if not def_c.empty else 0
        giveaways = int((off_c["interception"] + off_c["fumble_lost"]).sum()) if not off_c.empty else 0
        turnover_margin = takeaways - giveaways

        # Situacional: 3er Down
        third_plays = 0
        third_conv_pct = 0.0
        third_epa = 0.0
        if has_down:
            down_s = pd.to_numeric(off_c["down"], errors="coerce")
            d3 = off_c.loc[down_s == 3]
            third_plays = int(len(d3))
            if third_plays > 0:
                third_epa = float(d3["epa"].mean())
                if has_3d_conv:
                    conv_s = pd.to_numeric(d3["third_down_converted"], errors="coerce").fillna(0.0)
                    third_conv_pct = round(float(conv_s.mean()) * 100.0, 1)
                else:
                    third_conv_pct = round(float(d3["success"].mean()) * 100.0, 1)

        # Situacional: Zona Roja (yardline_100 <= 20)
        rz_plays = 0
        rz_epa = 0.0
        rz_td_pct = 0.0
        if has_yl100:
            yl_s = pd.to_numeric(off_c["yardline_100"], errors="coerce")
            rz = off_c.loc[(yl_s >= 1) & (yl_s <= 20)]
            rz_plays = int(len(rz))
            if rz_plays > 0:
                rz_epa = float(rz["epa"].mean())
                if has_td:
                    td_s = pd.to_numeric(rz["touchdown"], errors="coerce").fillna(0.0)
                    rz_td_pct = round(float(td_s.mean()) * 100.0, 1)
                else:
                    rz_td_pct = round(float(rz["success"].mean()) * 100.0, 1)

        # Situacional: 4to Down
        fourth_attempts = 0
        fourth_conv_pct = 0.0
        fourth_epa = 0.0
        if has_down:
            down_s = pd.to_numeric(off_c["down"], errors="coerce")
            d4 = off_c.loc[down_s == 4]
            fourth_attempts = int(len(d4))
            if fourth_attempts > 0:
                fourth_epa = float(d4["epa"].mean())
                if has_4d_conv:
                    c4_s = pd.to_numeric(d4["fourth_down_converted"], errors="coerce").fillna(0.0)
                    fourth_conv_pct = round(float(c4_s.mean()) * 100.0, 1)
                else:
                    fourth_conv_pct = round(float(d4["success"].mean()) * 100.0, 1)

        net_epa = off_epa - def_epa_allowed

        # FTN DVOA Proxy (escala porcentual calibrada -35% a +35% a partir de EPA/play y Success Rate)
        dvoa_off_pct = round(off_epa * 115.0 + (off_sr - 0.44) * 85.0, 1)
        dvoa_def_pct = round(def_epa_allowed * 115.0 + (def_sr_allowed - 0.44) * 85.0, 1)
        dvoa_total_pct = round(dvoa_off_pct - dvoa_def_pct, 1)

        # NFL Savant Pass-Direction Matrix por equipo
        pass_zones = _compute_pass_zones_matrix(pass_c)

        records.append(
            {
                "team": team,
                "games_played": games_played,
                "off_plays": off_plays,
                "raw_plays": raw_plays,
                "garbage_time_plays": gt_plays,
                "garbage_time_share_pct": gt_share_pct,
                "off_epa_per_play": round(off_epa, 3),
                "off_pass_epa": round(off_pass_epa, 3),
                "off_rush_epa": round(off_rush_epa, 3),
                "off_success_rate": round(off_sr, 4),
                "off_success_rate_pct": round(off_sr * 100.0, 1),
                "pass_rate_pct": pass_rate_pct,
                "proe_pct": proe_pct,
                "early_down_epa": round(early_down_epa, 3),
                "early_down_success_pct": early_down_sr_pct,
                "explosive_rate_pct": explosive_rate_pct,
                "yards_per_play": yards_per_play,
                "shotgun_rate_pct": shotgun_rate_pct,
                "no_huddle_rate_pct": no_huddle_rate_pct,
                "def_plays": def_plays,
                "def_epa_allowed": round(def_epa_allowed, 3),
                "def_pass_epa_allowed": round(def_pass_epa, 3),
                "def_rush_epa_allowed": round(def_rush_epa, 3),
                "def_success_allowed": round(def_sr_allowed, 4),
                "def_success_allowed_pct": round(def_sr_allowed * 100.0, 1),
                "def_pressure_rate_pct": def_pressure_rate_pct,
                "turnover_margin": turnover_margin,
                "net_epa_per_play": round(net_epa, 3),
                "dvoa_total_pct": dvoa_total_pct,
                "dvoa_off_pct": dvoa_off_pct,
                "dvoa_def_pct": dvoa_def_pct,
                "effective_cap_space_m": TEAM_EFFECTIVE_CAP_SPACE_M.get(team, 15.0),
                "third_down_plays": third_plays,
                "third_down_conv_pct": third_conv_pct,
                "third_down_epa": round(third_epa, 3),
                "red_zone_plays": rz_plays,
                "red_zone_epa": round(rz_epa, 3),
                "red_zone_td_pct": rz_td_pct,
                "fourth_down_attempts": fourth_attempts,
                "fourth_down_conv_pct": fourth_conv_pct,
                "fourth_down_epa": round(fourth_epa, 3),
                "pass_zones": pass_zones,
            }
        )

    if not records:
        return []

    off_med = float(np.median([r["off_epa_per_play"] for r in records]))
    def_med = float(np.median([r["def_epa_allowed"] for r in records]))

    for r in records:
        good_off = r["off_epa_per_play"] >= off_med
        good_def = r["def_epa_allowed"] <= def_med
        if good_off and good_def:
            r["tier"] = "Contendiente Élite"
        elif good_off and not good_def:
            r["tier"] = "Potencia Ofensiva"
        elif not good_off and good_def:
            r["tier"] = "Muralla Defensiva"
        else:
            r["tier"] = "En Reconstrucción"

    records.sort(key=lambda x: (x["net_epa_per_play"], x["off_epa_per_play"]), reverse=True)
    for idx, r in enumerate(records, 1):
        r["rank"] = idx

    return records


def _load_from_ingest() -> tuple[pd.DataFrame, pd.DataFrame, dict[str, Any]]:
    """Carga PBP y Rosters desde `src.ingest_nflverse` de forma resiliente."""
    from src import ingest_nflverse

    metadata: dict[str, Any] = {}
    pbp_df = pd.DataFrame()
    roster_df = pd.DataFrame()

    if hasattr(ingest_nflverse, "detect_and_load_pbp"):
        res = ingest_nflverse.detect_and_load_pbp()
        if isinstance(res, tuple):
            pbp_df, metadata = res[0], (res[1] if len(res) > 1 and isinstance(res[1], dict) else {})
        elif isinstance(res, pd.DataFrame):
            pbp_df = res
    elif hasattr(ingest_nflverse, "load_pbp"):
        pbp_df = ingest_nflverse.load_pbp()

    season = (
        metadata.get("season")
        or metadata.get("active_season")
        or (
            int(pbp_df["season"].dropna().iloc[0])
            if not pbp_df.empty and "season" in pbp_df.columns and not pbp_df["season"].dropna().empty
            else datetime.now(timezone.utc).year
        )
    )

    if hasattr(ingest_nflverse, "load_rosters"):
        try:
            roster_res = ingest_nflverse.load_rosters(season)
            roster_df = roster_res[0] if isinstance(roster_res, tuple) else roster_res
        except TypeError:
            roster_df = ingest_nflverse.load_rosters()

    return pbp_df, roster_df, metadata


def run_valuation_pipeline(
    pbp_df: pd.DataFrame | None = None,
    roster_df: pd.DataFrame | None = None,
    metadata: dict[str, Any] | None = None,
    output_path: Path | str | None = None,
) -> dict[str, Any]:
    """Ejecuta el pipeline completo de valoración y guarda `public/data/player_rankings.json`."""
    from src import ingest_nflverse

    meta = dict(metadata) if metadata else {}
    is_live_pipeline = pbp_df is None

    if pbp_df is None:
        loaded_pbp, loaded_roster, loaded_meta = _load_from_ingest()
        pbp_df = loaded_pbp
        if roster_df is None:
            roster_df = loaded_roster
        for k, v in loaded_meta.items():
            meta.setdefault(k, v)

    current_year = datetime.now(timezone.utc).year
    season = int(
        meta.get("season")
        or meta.get("active_season")
        or (
            pbp_df["season"].dropna().iloc[0]
            if pbp_df is not None and not pbp_df.empty and "season" in pbp_df.columns and not pbp_df["season"].dropna().empty
            else current_year
        )
    )

    contracts_lookup: dict[str, dict[str, float]] = {}
    ngs_lookup: dict[str, dict[str, Any]] = {}
    if is_live_pipeline:
        if hasattr(ingest_nflverse, "load_otc_contracts"):
            contracts_lookup = _build_contracts_lookup(ingest_nflverse.load_otc_contracts())
        if hasattr(ingest_nflverse, "load_ngs_season_averages"):
            ngs_lookup = ingest_nflverse.load_ngs_season_averages(season=season)

    ranked_df = evaluate_players(pbp_df, roster_df, contracts_lookup=contracts_lookup, ngs_lookup=ngs_lookup)
    teams_list = evaluate_teams(pbp_df)

    requested_season = int(meta.get("requested_season", season))
    fallback_used = bool(meta.get("fallback_used", season != requested_season))
    fallback_reason = meta.get("fallback_reason")

    players_list: list[dict[str, Any]] = ranked_df.to_dict(orient="records") if not ranked_df.empty else []

    def _pick_leaders(p_list: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        if not p_list:
            return None, None
        mvp = p_list[0]
        cands = [p for p in p_list if p["player_id"] != mvp["player_id"]] or p_list
        gt_cands = [p for p in cands if float(p.get("garbage_time_yards", 0.0)) > 0] or cands
        infl = max(
            gt_cands,
            key=lambda p: (
                float(p.get("inflation_index", 0.0)) * np.log1p(max(float(p.get("garbage_time_yards", 0.0)), 1.0)),
                float(p.get("garbage_time_yards", 0.0)),
                float(p.get("epa_inflation_delta", 0.0)),
            ),
        )
        return mvp, infl

    mvp_real, inflated_stat_leader = _pick_leaders(players_list)

    comp_df_meta, raw_df_meta = filter_garbage_time(pbp_df)
    weeks_included = (
        sorted(pd.to_numeric(raw_df_meta["week"], errors="coerce").dropna().astype(int).unique().tolist())
        if not raw_df_meta.empty and "week" in raw_df_meta.columns
        else meta.get("weeks_included", [])
    )
    games_monitored = (
        int(raw_df_meta["game_id"].dropna().nunique())
        if not raw_df_meta.empty and "game_id" in raw_df_meta.columns
        else int(meta.get("games_monitored", 0))
    )

    rankings_by_scope: dict[str, dict[str, Any]] = {}
    if len(weeks_included) > 1 and pbp_df is not None and "week" in pbp_df.columns:
        week_num_s = pd.to_numeric(pbp_df["week"], errors="coerce").fillna(0).astype(int)
        for w in weeks_included:
            df_w = pbp_df.loc[week_num_s == w]
            ranked_w = evaluate_players(df_w, roster_df, contracts_lookup=contracts_lookup, ngs_lookup=ngs_lookup)
            list_w = ranked_w.to_dict(orient="records") if not ranked_w.empty else []
            mvp_w, inf_w = _pick_leaders(list_w)
            games_w = int(df_w["game_id"].dropna().nunique()) if "game_id" in df_w.columns else 0
            rankings_by_scope[f"WEEK_{w}"] = {
                "label": f"Solo Semana {w} ({games_w} partidos)",
                "weeks": [w],
                "games_monitored": games_w,
                "total_plays": int(len(df_w)),
                "mvp_real": mvp_w,
                "inflated_stat_leader": inf_w,
                "players": list_w,
                "teams": evaluate_teams(df_w),
            }

            if 1 < w < max(weeks_included):
                df_cum = pbp_df.loc[(week_num_s >= 1) & (week_num_s <= w)]
                ranked_cum = evaluate_players(df_cum, roster_df, contracts_lookup=contracts_lookup, ngs_lookup=ngs_lookup)
                list_cum = ranked_cum.to_dict(orient="records") if not ranked_cum.empty else []
                mvp_cum, inf_cum = _pick_leaders(list_cum)
                games_cum = int(df_cum["game_id"].dropna().nunique()) if "game_id" in df_cum.columns else 0
                rankings_by_scope[f"CUM_{w}"] = {
                    "label": f"Acumulado Semanas 1 a {w} ({games_cum} partidos)",
                    "weeks": list(range(1, w + 1)),
                    "games_monitored": games_cum,
                    "total_plays": int(len(df_cum)),
                    "mvp_real": mvp_cum,
                    "inflated_stat_leader": inf_cum,
                    "players": list_cum,
                    "teams": evaluate_teams(df_cum),
                }

    payload: dict[str, Any] = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "season": season,
        "requested_season": requested_season,
        "fallback_used": fallback_used,
        "fallback_reason": fallback_reason,
        "season_coverage": {
            "preseason_excluded": True,
            "season_types": ["REG", "POST"],
            "games_monitored": games_monitored,
            "weeks_included": weeks_included,
            "total_plays": int(len(raw_df_meta)),
            "competitive_plays": int(len(comp_df_meta)),
            "garbage_time_plays_excluded": int(len(raw_df_meta) - len(comp_df_meta)),
        },
        "methodology": {
            "preseason_rule": "Excluye el 100% de partidos de Pretemporada (season_type != PRE); analiza todos los partidos de Temporada Regular (REG) y Postemporada (POST).",
            "garbage_time_rule": "Excluye jugadas con qtr == 4 y (wp < 0.05 o wp > 0.95)",
            "min_opportunities_per_week": MIN_OPPORTUNITIES_PER_WEEK,
            "formulas": {
                "QB": "0.45 * z(EPA_per_dropback) + 0.25 * z(WPA_total) + 0.20 * z(CPOE) + 0.10 * z(Success_Rate)",
                "RB": "0.50 * z(EPA_per_rush_and_rec) + 0.25 * z(Success_Rate) + 0.25 * z(WPA_total)",
                "WR_TE": "0.45 * z(EPA_per_target) + 0.30 * z(WPA_total) + 0.25 * z(YAC_EPA)",
            },
            "integrated_sources": [
                "Pro Football Reference (PFR)",
                "RBSDM (EPA+CPOE & PROE)",
                "Pro Football Focus (PFF Style Grade)",
                "FTN Fantasy (DVOA & Charting)",
                "NFL Next Gen Stats (NGS)",
                "SumerSports",
                "PlayerProfiler (WOPR & Target Share)",
                "Sharp Football Analysis",
                "NFL Savant (Pass Zones)",
                "TeamRankings & OverTheCap / Spotrac",
            ],
        },
        "mvp_real": mvp_real,
        "inflated_stat_leader": inflated_stat_leader,
        "players": players_list,
        "teams": teams_list,
        "rankings_by_scope": rankings_by_scope,
    }

    def _sanitize_json_value(val: Any) -> Any:
        if isinstance(val, dict):
            return {k: _sanitize_json_value(v) for k, v in val.items()}
        if isinstance(val, list):
            return [_sanitize_json_value(v) for v in val]
        if isinstance(val, (float, np.floating)):
            fval = float(val)
            return 0.0 if (np.isnan(fval) or np.isinf(fval)) else fval
        if isinstance(val, np.integer):
            return int(val)
        return val

    payload = _sanitize_json_value(payload)

    target_path = Path(output_path) if output_path is not None else DEFAULT_OUTPUT_PATH
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False, allow_nan=False),
        encoding="utf-8",
    )
    return payload


if __name__ == "__main__":
    run_valuation_pipeline()
