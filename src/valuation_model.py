"""Modelo Matemático y Actuarial de Valoración Objetiva de Jugadores NFL.

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


def filter_garbage_time(pbp_df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Separa el DataFrame Play-by-Play en jugadas competitivas y jugadas brutas totales.

    Una jugada es considerada minuto basura (Garbage Time) si ocurre en el 4to cuarto
    (`qtr == 4`) y la probabilidad de victoria antes de la jugada (`wp`) es menor a 0.05
    o mayor a 0.95.

    Args:
        pbp_df: DataFrame de jugadas de nflverse.

    Returns:
        Tupla `(competitive_df, raw_df)` donde `competitive_df` excluye minutos basura
        y `raw_df` conserva todas las jugadas con la columna `is_garbage_time`.
    """
    if pbp_df is None or pbp_df.empty:
        empty = pd.DataFrame() if pbp_df is None else pbp_df.copy()
        return empty.copy(), empty.copy()

    raw_df = pbp_df.copy()
    qtr = pd.to_numeric(raw_df.get("qtr", pd.Series(1, index=raw_df.index)), errors="coerce").fillna(1)
    wp = pd.to_numeric(raw_df.get("wp", pd.Series(0.5, index=raw_df.index)), errors="coerce").fillna(0.5)

    is_garbage = (qtr == 4) & ((wp < 0.05) | (wp > 0.95))
    raw_df["is_garbage_time"] = is_garbage.astype(bool)
    competitive_df = raw_df.loc[~is_garbage].copy()
    return competitive_df, raw_df


def compute_z_score(series: pd.Series) -> pd.Series:
    """Calcula el Z-score estándar `(series - mean) / std`.

    Si la desviación estándar es 0 o NaN, devuelve una serie de ceros.
    """
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
    """Convierte el Z-score compuesto a escala 0-100 mediante la CDF normal estándar.

    Re-estandariza `z_comp` dentro del grupo posicional cuando existe varianza no nula
    para aprovechar todo el rango percentil normal, truncando en [0.0, 100.0].
    """
    if z_comp is None or len(z_comp) == 0:
        return pd.Series(dtype=float)

    clean_z = pd.to_numeric(z_comp, errors="coerce").fillna(0.0).astype(float)
    z_restandardized = compute_z_score(clean_z)
    # Si todos tienen el mismo valor o hay un solo jugador, usar clean_z directamente
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


def _build_roster_lookup(roster_df: pd.DataFrame | None) -> dict[str, dict[str, str]]:
    """Construye un diccionario `gsis_id -> {position, full_name, team}` desde el roster."""
    if roster_df is None or roster_df.empty:
        return {}

    lookup: dict[str, dict[str, str]] = {}
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
        lookup[pid] = {
            "position": norm_pos if norm_pos in VALID_POSITIONS else "",
            "full_name": name,
            "team": team,
        }
    return lookup


def _extract_role_events(df: pd.DataFrame, roster_lookup: dict[str, dict[str, str]]) -> pd.DataFrame:
    """Extrae eventos individuales por jugador y rol (passer, rusher, receiver) desde el PBP."""
    if df is None or df.empty:
        return pd.DataFrame(
            columns=[
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
                "success",
            ]
        )

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
        return pd.DataFrame(
            columns=[
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
                "success",
            ]
        )

    n_rows = len(work)
    week_s = pd.to_numeric(work.get("week", pd.Series(1, index=work.index)), errors="coerce").fillna(1).astype(int)
    team_s = work.get("posteam", work.get("team", pd.Series("NFL", index=work.index))).fillna("NFL").astype(str)
    epa_s = pd.to_numeric(work.get("epa", pd.Series(0.0, index=work.index)), errors="coerce").fillna(0.0)
    qb_epa_s = pd.to_numeric(work.get("qb_epa", epa_s), errors="coerce").fillna(epa_s)
    wpa_s = pd.to_numeric(work.get("wpa", pd.Series(0.0, index=work.index)), errors="coerce").fillna(0.0)
    yards_gained_s = pd.to_numeric(work.get("yards_gained", pd.Series(0.0, index=work.index)), errors="coerce").fillna(0.0)
    cpoe_s = pd.to_numeric(work.get("cpoe", pd.Series(np.nan, index=work.index)), errors="coerce")
    yac_epa_s = pd.to_numeric(work.get("yac_epa", pd.Series(0.0, index=work.index)), errors="coerce").fillna(0.0)

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

    # 1. Eventos de QB / Dropbacks
    passer_id_col = "passer_player_id" if "passer_player_id" in work.columns else None
    passer_name_col = "passer_player_name" if "passer_player_name" in work.columns else None
    rusher_id_col = "rusher_player_id" if "rusher_player_id" in work.columns else None
    rusher_name_col = "rusher_player_name" if "rusher_player_name" in work.columns else None
    qb_dropback_s = pd.to_numeric(work.get("qb_dropback", pd.Series(0, index=work.index)), errors="coerce").fillna(0)

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
                        "success": success_s.loc[p_mask],
                    }
                )
            )

    # Scrambles de QB donde passer_player_id es nulo pero qb_dropback == 1 y el corredor es QB
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
                        "success": success_s.loc[qb_scramble_mask],
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
                        "success": success_s.loc[rush_mask],
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
                        "success": success_s.loc[rec_mask],
                    }
                )
            )

    if not events:
        return pd.DataFrame(
            columns=[
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
                "success",
            ]
        )

    return pd.concat(events, ignore_index=True)


def _infer_position(
    player_id: str,
    player_name: str,
    explicit_pos: str,
    dropbacks: int,
    rushes: int,
    targets: int,
    roster_lookup: dict[str, dict[str, str]],
) -> str:
    """Determina la posición oficial del jugador (`QB`, `RB`, `WR`, `TE`)."""
    roster_info = roster_lookup.get(player_id, {})
    roster_pos = roster_info.get("position", "")
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
    if events_df.empty:
        return pd.DataFrame(
            columns=[
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
        )

    work = events_df.copy()
    work["position"] = work["player_id"].map(position_map)
    work = work.loc[work["position"].isin(VALID_POSITIONS)].copy()

    # Filtrar los eventos que corresponden a la fórmula de cada posición:
    # QB -> QB_DROPBACK; RB -> RUSH o TARGET; WR/TE -> TARGET
    role_filter = (
        ((work["position"] == "QB") & (work["role"] == "QB_DROPBACK"))
        | ((work["position"] == "RB") & (work["role"].isin(["RUSH", "TARGET"])))
        | ((work["position"].isin(["WR", "TE"])) & (work["role"] == "TARGET"))
    )
    work = work.loc[role_filter].copy()

    if work.empty:
        return pd.DataFrame(
            columns=[
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
        )

    grouped = work.groupby("player_id", as_index=False).agg(
        opportunities=("epa", "count"),
        weeks_played=("week", "nunique"),
        yards=("yards", "sum"),
        epa_total=("epa", "sum"),
        epa_per_play=("epa", "mean"),
        wpa_total=("wpa", "sum"),
        cpoe=("cpoe", "mean"),
        yac_epa=("yac_epa", "sum"),
        success_rate=("success", "mean"),
    )
    grouped["weeks_played"] = grouped["weeks_played"].clip(lower=1).astype(int)
    grouped["cpoe"] = grouped["cpoe"].fillna(0.0)
    grouped["yac_epa"] = grouped["yac_epa"].fillna(0.0)
    grouped["success_rate"] = grouped["success_rate"].fillna(0.0)
    return grouped


def evaluate_players(
    pbp_df: pd.DataFrame,
    roster_df: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Ejecuta el modelo actuarial completo sobre el dataset Play-by-Play.

    1. Separa jugadas competitivas y brutas (`filter_garbage_time`).
    2. Determina la posición (`QB`, `RB`, `WR`, `TE`) cruzando con `roster_df` o rol.
    3. Filtra por mínimo de participación semanal (15 QB, 10 RB, 5 WR/TE).
    4. Calcula Z-scores e Impact Score (0-100) normalizados por posición.
    5. Calcula el Índice de Inflación Estadística (`inflation_index`).
    """
    competitive_df, raw_df = filter_garbage_time(pbp_df)
    roster_lookup = _build_roster_lookup(roster_df)

    raw_events = _extract_role_events(raw_df, roster_lookup)
    if raw_events.empty:
        return pd.DataFrame()

    comp_events = _extract_role_events(competitive_df, roster_lookup)

    # Contar roles por jugador para inferir posición y metadatos básicos
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

    for _, row in meta_rows.iterrows():
        pid = str(row["player_id"])
        r_info = roster_lookup.get(pid, {})
        pname = r_info.get("full_name") or str(row["player_name"])
        pteam = r_info.get("team") or str(row["team"])
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

    raw_summary = _summarize_events_by_position(raw_events, position_map)
    if raw_summary.empty:
        return pd.DataFrame()

    comp_summary = _summarize_events_by_position(comp_events, position_map)

    merged = raw_summary.rename(
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

    # Rellenar con 0 cuando un jugador solo tuvo jugadas en minutos basura
    zero_fill_cols = [
        "competitive_opportunities",
        "competitive_yards",
        "epa_total",
        "epa_per_play",
        "wpa_total",
        "cpoe",
        "yac_epa",
        "success_rate",
    ]
    for col in zero_fill_cols:
        merged[col] = merged[col].fillna(0.0)

    merged["competitive_opportunities"] = merged["competitive_opportunities"].astype(int)
    merged["raw_opportunities"] = merged["raw_opportunities"].astype(int)
    merged["player_name"] = merged["player_id"].map(name_map)
    merged["name"] = merged["player_name"]
    merged["gsis_id"] = merged["player_id"]
    merged["team"] = merged["player_id"].map(team_map)
    merged["position"] = merged["player_id"].map(position_map)

    # Semanas jugadas y oportunidades por semana para filtro de participación mínima
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

    # Alias específicos por posición para las fórmulas exactas
    qualified["epa_per_dropback"] = np.where(qualified["position"] == "QB", qualified["epa_per_play"], 0.0)
    qualified["epa_per_rush_and_rec"] = np.where(qualified["position"] == "RB", qualified["epa_per_play"], 0.0)
    qualified["epa_per_target"] = np.where(
        qualified["position"].isin(["WR", "TE"]), qualified["epa_per_play"], 0.0
    )

    # Calcular Score de Impacto e Índice de Inflación por posición
    scored_groups: list[pd.DataFrame] = []

    qb_df = qualified.loc[qualified["position"] == "QB"].copy()
    if not qb_df.empty:
        scored_groups.append(compute_qb_impact(qb_df))

    rb_df = qualified.loc[qualified["position"] == "RB"].copy()
    if not rb_df.empty:
        scored_groups.append(compute_rb_impact(rb_df))

    # Para WR y TE: normalizar por posición individual cuando hay >= 2 jugadores,
    # o conjuntamente como receptores si una subposición tiene solo 1 jugador
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

    # Calcular brecha estandarizada z(raw_yards) - z(epa_total) dentro de cada posición
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
    meta = dict(metadata) if metadata else {}

    if pbp_df is None:
        loaded_pbp, loaded_roster, loaded_meta = _load_from_ingest()
        pbp_df = loaded_pbp
        if roster_df is None:
            roster_df = loaded_roster
        for k, v in loaded_meta.items():
            meta.setdefault(k, v)

    ranked_df = evaluate_players(pbp_df, roster_df)

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
    requested_season = int(meta.get("requested_season", season))
    fallback_used = bool(meta.get("fallback_used", season != requested_season))
    fallback_reason = meta.get("fallback_reason")

    players_list: list[dict[str, Any]] = ranked_df.to_dict(orient="records") if not ranked_df.empty else []

    mvp_real: dict[str, Any] | None = None
    inflated_stat_leader: dict[str, Any] | None = None

    if players_list:
        mvp_real = players_list[0]
        # Seleccionar el líder de inflación estadística (mayor brecha entre yardas brutas y EPA competitivo)
        candidates = [p for p in players_list if p["player_id"] != mvp_real["player_id"]] or players_list
        gt_candidates = [p for p in candidates if float(p.get("garbage_time_yards", 0.0)) > 0] or candidates
        inflated_stat_leader = max(
            gt_candidates,
            key=lambda p: (
                float(p.get("inflation_index", 0.0)) * np.log1p(max(float(p.get("garbage_time_yards", 0.0)), 1.0)),
                float(p.get("garbage_time_yards", 0.0)),
                float(p.get("epa_inflation_delta", 0.0)),
            ),
        )

    payload: dict[str, Any] = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "season": season,
        "requested_season": requested_season,
        "fallback_used": fallback_used,
        "fallback_reason": fallback_reason,
        "methodology": {
            "garbage_time_rule": "Excluye jugadas con qtr == 4 y (wp < 0.05 o wp > 0.95)",
            "min_opportunities_per_week": MIN_OPPORTUNITIES_PER_WEEK,
            "formulas": {
                "QB": "0.45 * z(EPA_per_dropback) + 0.25 * z(WPA_total) + 0.20 * z(CPOE) + 0.10 * z(Success_Rate)",
                "RB": "0.50 * z(EPA_per_rush_and_rec) + 0.25 * z(Success_Rate) + 0.25 * z(WPA_total)",
                "WR_TE": "0.45 * z(EPA_per_target) + 0.30 * z(WPA_total) + 0.25 * z(YAC_EPA)",
            },
        },
        "mvp_real": mvp_real,
        "inflated_stat_leader": inflated_stat_leader,
        "players": players_list,
    }

    target_path = Path(output_path) if output_path is not None else DEFAULT_OUTPUT_PATH
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return payload


if __name__ == "__main__":
    run_valuation_pipeline()
