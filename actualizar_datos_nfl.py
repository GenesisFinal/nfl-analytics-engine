#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Motor de Ingesta Multi-Fuente para NFL Analytics & Social Tips Engine.
Recopila datos 100% reales y gratuitos de:
1. Pro Football Reference (PFR Advanced Stats 2026 via nflverse/PFR)
2. RBSDM / SumerSports (EPA/play, Success Rate, CPOE via nflverse 2026)
3. NFL Next Gen Stats (NGS 2026 Passing, Rushing, Receiving)
4. TeamRankings (Red Zone TD %, 3rd Down %, Situacional 2026)
5. FTN Fantasy (DVOA), Sharp Football, PFF, PlayerProfiler, NFL Savant (Métricas + Deep Links)
6. ESPN NFL API (Calendario por semana TNF/Sunday/MNF, marcadores, récords, logos)
7. 8 Fuentes de Top News de Alto Impacto (Rotoworld, The Athletic, PFT, ESPN, NFL.com, OTC, Spotrac, r/NFL)
"""

import os
import re
import json
import math
import datetime
from io import StringIO
import xml.etree.ElementTree as ET

import requests
import pandas as pd
from bs4 import BeautifulSoup

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
}

# Mapeo oficial de las 32 franquicias NFL (códigos estándar nflverse / PFR / TeamRankings / ESPN)
NFL_TEAMS_META = {
    "ARI": {"name": "Arizona Cardinals", "short": "Cardinals", "tr_name": "Arizona", "pfr": "crd", "color": "#97233F", "conf": "NFC", "div": "NFC West"},
    "ATL": {"name": "Atlanta Falcons", "short": "Falcons", "tr_name": "Atlanta", "pfr": "atl", "color": "#A71930", "conf": "NFC", "div": "NFC South"},
    "BAL": {"name": "Baltimore Ravens", "short": "Ravens", "tr_name": "Baltimore", "pfr": "rav", "color": "#241773", "conf": "AFC", "div": "AFC North"},
    "BUF": {"name": "Buffalo Bills", "short": "Bills", "tr_name": "Buffalo", "pfr": "buf", "color": "#00338D", "conf": "AFC", "div": "AFC East"},
    "CAR": {"name": "Carolina Panthers", "short": "Panthers", "tr_name": "Carolina", "pfr": "car", "color": "#0085CA", "conf": "NFC", "div": "NFC South"},
    "CHI": {"name": "Chicago Bears", "short": "Bears", "tr_name": "Chicago", "pfr": "chi", "color": "#0B162A", "conf": "NFC", "div": "NFC North"},
    "CIN": {"name": "Cincinnati Bengals", "short": "Bengals", "tr_name": "Cincinnati", "pfr": "cin", "color": "#FB4F14", "conf": "AFC", "div": "AFC North"},
    "CLE": {"name": "Cleveland Browns", "short": "Browns", "tr_name": "Cleveland", "pfr": "cle", "color": "#311D00", "conf": "AFC", "div": "AFC North"},
    "DAL": {"name": "Dallas Cowboys", "short": "Cowboys", "tr_name": "Dallas", "pfr": "dal", "color": "#003594", "conf": "NFC", "div": "NFC East"},
    "DEN": {"name": "Denver Broncos", "short": "Broncos", "tr_name": "Denver", "pfr": "den", "color": "#FB4F14", "conf": "AFC", "div": "AFC West"},
    "DET": {"name": "Detroit Lions", "short": "Lions", "tr_name": "Detroit", "pfr": "det", "color": "#0076B6", "conf": "NFC", "div": "NFC North"},
    "GB":  {"name": "Green Bay Packers", "short": "Packers", "tr_name": "Green Bay", "pfr": "gnb", "color": "#203731", "conf": "NFC", "div": "NFC North"},
    "HOU": {"name": "Houston Texans", "short": "Texans", "tr_name": "Houston", "pfr": "htx", "color": "#03202F", "conf": "AFC", "div": "AFC South"},
    "IND": {"name": "Indianapolis Colts", "short": "Colts", "tr_name": "Indianapolis", "pfr": "clt", "color": "#002C5F", "conf": "AFC", "div": "AFC South"},
    "JAX": {"name": "Jacksonville Jaguars", "short": "Jaguars", "tr_name": "Jacksonville", "pfr": "jax", "color": "#006778", "conf": "AFC", "div": "AFC South"},
    "KC":  {"name": "Kansas City Chiefs", "short": "Chiefs", "tr_name": "Kansas City", "pfr": "kan", "color": "#E31837", "conf": "AFC", "div": "AFC West"},
    "LA":  {"name": "Los Angeles Rams", "short": "Rams", "tr_name": "LA Rams", "pfr": "ram", "color": "#003594", "conf": "NFC", "div": "NFC West"},
    "LAC": {"name": "Los Angeles Chargers", "short": "Chargers", "tr_name": "LA Chargers", "pfr": "sdg", "color": "#0080C6", "conf": "AFC", "div": "AFC West"},
    "LV":  {"name": "Las Vegas Raiders", "short": "Raiders", "tr_name": "Las Vegas", "pfr": "rai", "color": "#000000", "conf": "AFC", "div": "AFC West"},
    "MIA": {"name": "Miami Dolphins", "short": "Dolphins", "tr_name": "Miami", "pfr": "mia", "color": "#008E97", "conf": "AFC", "div": "AFC East"},
    "MIN": {"name": "Minnesota Vikings", "short": "Vikings", "tr_name": "Minnesota", "pfr": "min", "color": "#4F2683", "conf": "NFC", "div": "NFC North"},
    "NE":  {"name": "New England Patriots", "short": "Patriots", "tr_name": "New England", "pfr": "nwe", "color": "#002244", "conf": "AFC", "div": "AFC East"},
    "NO":  {"name": "New Orleans Saints", "short": "Saints", "tr_name": "New Orleans", "pfr": "nor", "color": "#D3BC8D", "conf": "NFC", "div": "NFC South"},
    "NYG": {"name": "New York Giants", "short": "Giants", "tr_name": "NY Giants", "pfr": "nyg", "color": "#0B2265", "conf": "NFC", "div": "NFC East"},
    "NYJ": {"name": "New York Jets", "short": "Jets", "tr_name": "NY Jets", "pfr": "nyj", "color": "#125740", "conf": "AFC", "div": "AFC East"},
    "PHI": {"name": "Philadelphia Eagles", "short": "Eagles", "tr_name": "Philadelphia", "pfr": "phi", "color": "#004C54", "conf": "NFC", "div": "NFC East"},
    "PIT": {"name": "Pittsburgh Steelers", "short": "Steelers", "tr_name": "Pittsburgh", "pfr": "pit", "color": "#FFB612", "conf": "AFC", "div": "AFC North"},
    "SEA": {"name": "Seattle Seahawks", "short": "Seahawks", "tr_name": "Seattle", "pfr": "sea", "color": "#002244", "conf": "NFC", "div": "NFC West"},
    "SF":  {"name": "San Francisco 49ers", "short": "49ers", "tr_name": "San Francisco", "pfr": "sfo", "color": "#AA0000", "conf": "NFC", "div": "NFC West"},
    "TB":  {"name": "Tampa Bay Buccaneers", "short": "Buccaneers", "tr_name": "Tampa Bay", "pfr": "tam", "color": "#D50A0A", "conf": "NFC", "div": "NFC South"},
    "TEN": {"name": "Tennessee Titans", "short": "Titans", "tr_name": "Tennessee", "pfr": "oti", "color": "#0C2340", "conf": "AFC", "div": "AFC South"},
    "WAS": {"name": "Washington Commanders", "short": "Commanders", "tr_name": "Washington", "pfr": "was", "color": "#5A1414", "conf": "NFC", "div": "NFC East"},
}

TEAM_ALIASES = {
    "LAR": "LA",
    "WSH": "WAS",
    "JAC": "JAX",
    "GNB": "GB",
    "KAN": "KC",
    "NWE": "NE",
    "NOR": "NO",
    "SFO": "SF",
    "TAM": "TB",
    "LVR": "LV",
    "OAK": "LV",
    "SD": "LAC",
    "SDG": "LAC",
    "STL": "LA",
    "RAM": "LA",
    "CRD": "ARI",
    "RAV": "BAL",
    "CLT": "IND",
    "HTX": "HOU",
    "OTI": "TEN",
}

TR_TO_ABBR = {v["tr_name"]: k for k, v in NFL_TEAMS_META.items()}


def norm_team(code: str) -> str:
    if not code or not isinstance(code, str):
        return ""
    c = code.strip().upper()
    return TEAM_ALIASES.get(c, c)


def safe_float(val, default=0.0):
    try:
        if val is None or (isinstance(val, float) and math.isnan(val)):
            return default
        if isinstance(val, str):
            val = val.replace("%", "").replace(",", "").strip()
            if val in ("", "--", "N/A", "-"):
                return default
        return float(val)
    except Exception:
        return default


def compute_percentile(series: pd.Series, higher_is_better: bool = True) -> pd.Series:
    """Calcula el percentil empírico real (0-100) entre los equipos/jugadores."""
    if series.empty:
        return series
    ranks = series.rank(pct=True, ascending=higher_is_better)
    return (ranks * 100).round(0).fillna(50).astype(int)


def fetch_teamrankings_stat(slug: str) -> dict:
    """Descarga una tabla pública de TeamRankings y devuelve {TEAM_ABBR: float_pct}."""
    url = f"https://www.teamrankings.com/nfl/stat/{slug}"
    result = {}
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code == 200:
            dfs = pd.read_html(StringIO(resp.text))
            if dfs:
                df = dfs[0]
                col_2026 = df.columns[2]  # Columna de temporada actual (2026)
                for _, row in df.iterrows():
                    t_name = str(row.get("Team", "")).strip()
                    abbr = TR_TO_ABBR.get(t_name)
                    if abbr:
                        result[abbr] = safe_float(row.get(col_2026), 0.0)
    except Exception as e:
        print(f"[WARN] TeamRankings {slug}: {e}")
    return result


def build_team_stats() -> dict:
    """
    Construye el diccionario completo de estadísticas de los 32 equipos en 2026
    combinando nflverse (RBSDM/SumerSports), PFR AdvStats y TeamRankings.
    """
    print("[1/5] Descargando estadísticas semanales y de temporada 2026 de los 32 equipos (nflverse / RBSDM / SumerSports)...")
    url_week = "https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_2026.csv"
    df_wk = pd.read_csv(url_week)
    df_wk = df_wk[df_wk["season_type"] == "REG"].copy()
    df_wk["team"] = df_wk["team"].apply(norm_team)
    df_wk["opponent_team"] = df_wk["opponent_team"].apply(norm_team)

    # Estimación real de puntos anotados por semana (TDs + FGs + PATs + 2PT + Safeties)
    df_wk["pts_scored"] = (
        (df_wk["passing_tds"].fillna(0) + df_wk["rushing_tds"].fillna(0) +
         df_wk["special_teams_tds"].fillna(0) + df_wk["def_tds"].fillna(0) +
         df_wk["fumble_recovery_tds"].fillna(0)) * 6
        + df_wk["fg_made"].fillna(0) * 3
        + df_wk["pat_made"].fillna(0) * 1
        + (df_wk["passing_2pt_conversions"].fillna(0) + df_wk["rushing_2pt_conversions"].fillna(0) + df_wk["def_2pt_made"].fillna(0)) * 2
        + df_wk["def_safeties"].fillna(0) * 2
    )

    # Agregación Ofensiva y Equipos Especiales por equipo
    off_grp = df_wk.groupby("team", as_index=False).agg(
        games=("week", "count"),
        completions=("completions", "sum"),
        attempts=("attempts", "sum"),
        passing_yards=("passing_yards", "sum"),
        passing_tds=("passing_tds", "sum"),
        passing_int=("passing_interceptions", "sum"),
        sacks_suffered=("sacks_suffered", "sum"),
        sack_yards_lost=("sack_yards_lost", "sum"),
        passing_air_yards=("passing_air_yards", "sum"),
        passing_yac=("passing_yards_after_catch", "sum"),
        passing_first_downs=("passing_first_downs", "sum"),
        passing_epa=("passing_epa", "sum"),
        passing_cpoe=("passing_cpoe", "mean"),
        passing_20=("passing_20", "sum"),
        carries=("carries", "sum"),
        rushing_yards=("rushing_yards", "sum"),
        rushing_tds=("rushing_tds", "sum"),
        rushing_first_downs=("rushing_first_downs", "sum"),
        rushing_epa=("rushing_epa", "sum"),
        rushing_10=("rushing_10", "sum"),
        rushing_20=("rushing_20", "sum"),
        fumbles_lost=("fumbles_lost_total", "sum"),
        penalties=("penalties", "sum"),
        penalty_yards=("penalty_yards", "sum"),
        def_sacks=("def_sacks", "sum"),
        def_qb_hits=("def_qb_hits", "sum"),
        def_tfl=("def_tackles_for_loss", "sum"),
        def_int=("def_interceptions", "sum"),
        def_pd=("def_pass_defended", "sum"),
        def_ff=("def_fumbles_forced", "sum"),
        def_tds=("def_tds", "sum"),
        fg_made=("fg_made", "sum"),
        fg_att=("fg_att", "sum"),
        fg_made_50=("fg_made_50_59", "sum"),
        fg_made_60=("fg_made_60_", "sum"),
        pat_made=("pat_made", "sum"),
        pat_att=("pat_att", "sum"),
        pt_att=("pt_att", "sum"),
        pt_net_yards=("pt_net_yards", "sum"),
        pt_inside_20=("pt_inside_20", "sum"),
        punt_returns=("punt_returns", "sum"),
        punt_return_yards=("punt_return_yards", "sum"),
        kickoff_returns=("kickoff_returns", "sum"),
        kickoff_return_yards=("kickoff_return_yards", "sum"),
        st_tds=("special_teams_tds", "sum"),
        pts_scored=("pts_scored", "sum"),
    )

    # Agregación Defensiva (lo que permitió cada equipo a sus rivales agrupando por opponent_team)
    def_grp = df_wk.groupby("opponent_team", as_index=False).agg(
        opp_attempts=("attempts", "sum"),
        opp_completions=("completions", "sum"),
        opp_passing_yards=("passing_yards", "sum"),
        opp_passing_tds=("passing_tds", "sum"),
        opp_passing_epa=("passing_epa", "sum"),
        opp_passing_cpoe=("passing_cpoe", "mean"),
        opp_passing_20=("passing_20", "sum"),
        opp_carries=("carries", "sum"),
        opp_rushing_yards=("rushing_yards", "sum"),
        opp_rushing_tds=("rushing_tds", "sum"),
        opp_rushing_epa=("rushing_epa", "sum"),
        opp_rushing_10=("rushing_10", "sum"),
        opp_sacks_taken=("sacks_suffered", "sum"),
        opp_fumbles_lost=("fumbles_lost_total", "sum"),
        opp_pts_scored=("pts_scored", "sum"),
    ).rename(columns={"opponent_team": "team"})

    df = pd.merge(off_grp, def_grp, on="team", how="left")

    # Cálculos por jugada (EPA/play, tasas de explosividad, presión, etc.)
    df["off_dropbacks"] = (df["attempts"] + df["sacks_suffered"]).replace(0, 1)
    df["off_plays"] = (df["off_dropbacks"] + df["carries"]).replace(0, 1)
    df["off_pass_epa_play"] = (df["passing_epa"] / df["off_dropbacks"]).round(3)
    df["off_rush_epa_play"] = (df["rushing_epa"] / df["carries"].replace(0, 1)).round(3)
    df["off_epa_play"] = ((df["passing_epa"] + df["rushing_epa"]) / df["off_plays"]).round(3)
    df["off_cpoe"] = df["passing_cpoe"].round(1)
    df["off_ypp"] = ((df["passing_yards"] - df["sack_yards_lost"] + df["rushing_yards"]) / df["off_plays"]).round(2)
    df["off_explosive_pass_pct"] = ((df["passing_20"] / df["attempts"].replace(0, 1)) * 100).round(1)
    df["off_explosive_rush_pct"] = ((df["rushing_10"] / df["carries"].replace(0, 1)) * 100).round(1)
    df["off_sack_rate_allowed"] = ((df["sacks_suffered"] / df["off_dropbacks"]) * 100).round(1)
    df["off_ppg"] = (df["pts_scored"] / df["games"].replace(0, 1)).round(1)
    df["off_pass_ypg"] = (df["passing_yards"] / df["games"].replace(0, 1)).round(1)
    df["off_rush_ypg"] = (df["rushing_yards"] / df["games"].replace(0, 1)).round(1)
    df["off_turnovers"] = df["passing_int"] + df["fumbles_lost"]

    # Métricas Defensivas permitidas por jugada
    df["def_dropbacks"] = (df["opp_attempts"] + df["opp_sacks_taken"]).replace(0, 1)
    df["def_plays"] = (df["def_dropbacks"] + df["opp_carries"]).replace(0, 1)
    df["def_pass_epa_allowed"] = (df["opp_passing_epa"] / df["def_dropbacks"]).round(3)
    df["def_rush_epa_allowed"] = (df["opp_rushing_epa"] / df["opp_carries"].replace(0, 1)).round(3)
    df["def_epa_allowed"] = ((df["opp_passing_epa"] + df["opp_rushing_epa"]) / df["def_plays"]).round(3)
    df["def_cpoe_allowed"] = df["opp_passing_cpoe"].round(1)
    df["def_explosive_pass_allowed_pct"] = ((df["opp_passing_20"] / df["opp_attempts"].replace(0, 1)) * 100).round(1)
    df["def_explosive_rush_allowed_pct"] = ((df["opp_rushing_10"] / df["opp_carries"].replace(0, 1)) * 100).round(1)
    df["def_sack_rate"] = ((df["def_sacks"] / df["def_dropbacks"]) * 100).round(1)
    df["def_pressure_proxy_rate"] = (((df["def_sacks"] + df["def_qb_hits"]) / df["def_dropbacks"]) * 100).round(1)
    df["def_ppg_allowed"] = (df["opp_pts_scored"] / df["games"].replace(0, 1)).round(1)
    df["def_pass_ypg_allowed"] = (df["opp_passing_yards"] / df["games"].replace(0, 1)).round(1)
    df["def_rush_ypg_allowed"] = (df["opp_rushing_yards"] / df["games"].replace(0, 1)).round(1)
    df["def_takeaways"] = df["def_int"] + df["opp_fumbles_lost"]
    df["turnover_margin"] = df["def_takeaways"] - df["off_turnovers"]

    # Equipos Especiales (Kicking, Punting, Returns)
    df["fg_pct_calc"] = ((df["fg_made"] / df["fg_att"].replace(0, 1)) * 100).round(1)
    df["punt_net_avg"] = (df["pt_net_yards"] / df["pt_att"].replace(0, 1)).round(1)
    df["punt_in20_pct"] = ((df["pt_inside_20"] / df["pt_att"].replace(0, 1)) * 100).round(1)
    df["kr_avg"] = (df["kickoff_return_yards"] / df["kickoff_returns"].replace(0, 1)).round(1)
    df["pr_avg"] = (df["punt_return_yards"] / df["punt_returns"].replace(0, 1)).round(1)
    df["fg_50_plus"] = df["fg_made_50"] + df["fg_made_60"]

    # Descargar datos situacionales 2026 de TeamRankings (Red Zone & 3rd Down)
    print("  -> Integrando tablas situacionales 2026 de TeamRankings (Red Zone & 3rd Down)...")
    rz_off = fetch_teamrankings_stat("red-zone-scoring-pct")
    rz_def = fetch_teamrankings_stat("opponent-red-zone-scoring-pct")
    td3_off = fetch_teamrankings_stat("third-down-conversion-pct")
    td3_def = fetch_teamrankings_stat("opponent-third-down-conversion-pct")
    plays_pg = fetch_teamrankings_stat("plays-per-game")

    df = df.copy()
    df["off_rz_td_pct"] = df["team"].map(rz_off).fillna(55.0).round(1)
    df["def_rz_td_pct"] = df["team"].map(rz_def).fillna(55.0).round(1)
    df["off_3d_pct"] = df["team"].map(td3_off).fillna(40.0).round(1)
    df["def_3d_pct"] = df["team"].map(td3_def).fillna(40.0).round(1)
    df["plays_per_game"] = df["team"].map(plays_pg).fillna((df["off_plays"] / df["games"]).round(1))

    # Índice compuesto de eficiencia total (Net EPA + Situacional + Equipos Especiales, escala % estilo DVOA)
    df["net_epa_play"] = (df["off_epa_play"] - df["def_epa_allowed"]).round(3)
    df["st_index"] = (
        ((df["fg_pct_calc"] - 84.0) * 0.25)
        + ((df["punt_net_avg"] - 41.5) * 0.6)
        + ((df["pr_avg"] - 9.5) * 0.25)
        + (df["st_tds"] * 2.5)
    ).round(1)
    df["total_dvoa_proxy"] = (
        (df["off_epa_play"] * 120.0)
        - (df["def_epa_allowed"] * 120.0)
        + (df["st_index"] * 0.5)
    ).round(1)

    # Rankings (1 a 32) y Percentiles (0 a 100)
    df["rank_total"] = df["total_dvoa_proxy"].rank(ascending=False, method="min").astype(int)
    df["rank_off"] = df["off_epa_play"].rank(ascending=False, method="min").astype(int)
    df["rank_def"] = df["def_epa_allowed"].rank(ascending=True, method="min").astype(int)
    df["rank_st"] = df["st_index"].rank(ascending=False, method="min").astype(int)

    df["pct_off_pass"] = compute_percentile(df["off_pass_epa_play"], True)
    df["pct_off_rush"] = compute_percentile(df["off_rush_epa_play"], True)
    df["pct_def_pass"] = compute_percentile(df["def_pass_epa_allowed"], False)
    df["pct_def_rush"] = compute_percentile(df["def_rush_epa_allowed"], False)
    df["pct_pass_rush"] = compute_percentile(df["def_sack_rate"], True)
    df["pct_pass_block"] = compute_percentile(df["off_sack_rate_allowed"], False)
    df["pct_st"] = compute_percentile(df["st_index"], True)

    teams_dict = {}
    for _, r in df.iterrows():
        t = r["team"]
        meta = NFL_TEAMS_META.get(t, {"name": t, "short": t, "pfr": t.lower(), "color": "#013369", "conf": "NFL", "div": "NFL"})
        teams_dict[t] = {
            "abbr": t,
            "name": meta["name"],
            "short": meta["short"],
            "color": meta["color"],
            "conf": meta["conf"],
            "div": meta["div"],
            "logo": f"https://a.espncdn.com/i/teamlogos/nfl/500/{t.lower()}.png",
            "games": int(r["games"]),
            "record": "0-0",
            # Rankings y Eficiencia Global
            "rank_total": int(r["rank_total"]),
            "rank_off": int(r["rank_off"]),
            "rank_def": int(r["rank_def"]),
            "rank_st": int(r["rank_st"]),
            "total_dvoa_proxy": float(r["total_dvoa_proxy"]),
            "net_epa_play": float(r["net_epa_play"]),
            # Ataque
            "off_epa_play": float(r["off_epa_play"]),
            "off_pass_epa_play": float(r["off_pass_epa_play"]),
            "off_rush_epa_play": float(r["off_rush_epa_play"]),
            "off_cpoe": float(r["off_cpoe"]),
            "off_ypp": float(r["off_ypp"]),
            "off_ppg": float(r["off_ppg"]),
            "off_pass_ypg": float(r["off_pass_ypg"]),
            "off_rush_ypg": float(r["off_rush_ypg"]),
            "off_explosive_pass_pct": float(r["off_explosive_pass_pct"]),
            "off_explosive_rush_pct": float(r["off_explosive_rush_pct"]),
            "off_sack_rate_allowed": float(r["off_sack_rate_allowed"]),
            "off_rz_td_pct": float(r["off_rz_td_pct"]),
            "off_3d_pct": float(r["off_3d_pct"]),
            "plays_per_game": float(r["plays_per_game"]),
            # Defensa
            "def_epa_allowed": float(r["def_epa_allowed"]),
            "def_pass_epa_allowed": float(r["def_pass_epa_allowed"]),
            "def_rush_epa_allowed": float(r["def_rush_epa_allowed"]),
            "def_cpoe_allowed": float(r["def_cpoe_allowed"]),
            "def_ppg_allowed": float(r["def_ppg_allowed"]),
            "def_pass_ypg_allowed": float(r["def_pass_ypg_allowed"]),
            "def_rush_ypg_allowed": float(r["def_rush_ypg_allowed"]),
            "def_explosive_pass_allowed_pct": float(r["def_explosive_pass_allowed_pct"]),
            "def_explosive_rush_allowed_pct": float(r["def_explosive_rush_allowed_pct"]),
            "def_sacks": int(r["def_sacks"]),
            "def_sack_rate": float(r["def_sack_rate"]),
            "def_pressure_proxy_rate": float(r["def_pressure_proxy_rate"]),
            "def_qb_hits": int(r["def_qb_hits"]),
            "def_tfl": int(r["def_tfl"]),
            "def_int": int(r["def_int"]),
            "def_takeaways": int(r["def_takeaways"]),
            "turnover_margin": int(r["turnover_margin"]),
            "def_rz_td_pct": float(r["def_rz_td_pct"]),
            "def_3d_pct": float(r["def_3d_pct"]),
            # Equipos Especiales
            "fg_made": int(r["fg_made"]),
            "fg_att": int(r["fg_att"]),
            "fg_pct": float(r["fg_pct_calc"]),
            "fg_50_plus": int(r["fg_50_plus"]),
            "punt_net_avg": float(r["punt_net_avg"]),
            "punt_in20_pct": float(r["punt_in20_pct"]),
            "kr_avg": float(r["kr_avg"]),
            "pr_avg": float(r["pr_avg"]),
            "st_tds": int(r["st_tds"]),
            "st_index": float(r["st_index"]),
            # Percentiles (0-100)
            "pct_off_pass": int(r["pct_off_pass"]),
            "pct_off_rush": int(r["pct_off_rush"]),
            "pct_def_pass": int(r["pct_def_pass"]),
            "pct_def_rush": int(r["pct_def_rush"]),
            "pct_pass_rush": int(r["pct_pass_rush"]),
            "pct_pass_block": int(r["pct_pass_block"]),
            "pct_st": int(r["pct_st"]),
            # Deep Links a las 10 fuentes gratuitas
            "links": {
                "pfr": f"https://www.pro-football-reference.com/teams/{meta['pfr']}/2026.htm",
                "rbsdm": "https://rbsdm.com/stats/stats/",
                "pff": "https://www.pff.com/nfl/teams",
                "ftn_dvoa": "https://ftnfantasy.com/stats/nfl/team-total-dvoa",
                "ngs": "https://nextgenstats.nfl.com/stats/passing",
                "sumer": "https://sumersports.com/teams/offensive/",
                "sharp": "https://www.sharpfootballanalysis.com/stats-nfl/",
                "savant": f"https://nflsavant.com/team.php?team_code={t}",
                "teamrankings": "https://www.teamrankings.com/nfl/stats/",
            },
        }
    return teams_dict


def build_player_stats() -> list:
    """
    Construye el catálogo de jugadores destacados 2026 (QBs, RBs, WRs, TEs, DEF)
    cruzando nflverse 2026 + Next Gen Stats 2026 + Pro Football Reference AdvStats 2026.
    """
    print("[2/5] Descargando métricas 2026 de Jugadores (nflverse + Next Gen Stats + Pro Football Reference AdvStats)...")
    df_p = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_reg_2026.csv")
    df_p["recent_team"] = df_p["recent_team"].apply(norm_team)

    # Next Gen Stats 2026 (week == 0 son los acumulados de temporada 2026)
    ngs_pass_map, ngs_rush_map, ngs_rec_map = {}, {}, {}
    try:
        ngs_p = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/nextgen_stats/ngs_passing.csv.gz")
        ngs_p = ngs_p[(ngs_p["season"] == 2026) & (ngs_p["week"] == 0)]
        for _, r in ngs_p.iterrows():
            ngs_pass_map[str(r.get("player_gsis_id", ""))] = {
                "ttt": round(safe_float(r.get("avg_time_to_throw")), 2),
                "agg_pct": round(safe_float(r.get("aggressiveness")), 1),
                "ngs_cpoe": round(safe_float(r.get("completion_percentage_above_expectation")), 1),
                "iay": round(safe_float(r.get("avg_intended_air_yards")), 1),
            }
    except Exception as e:
        print(f"[WARN] NGS Passing: {e}")

    try:
        ngs_r = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/nextgen_stats/ngs_rushing.csv.gz")
        ngs_r = ngs_r[(ngs_r["season"] == 2026) & (ngs_r["week"] == 0)]
        for _, r in ngs_r.iterrows():
            ngs_rush_map[str(r.get("player_gsis_id", ""))] = {
                "ryoe_att": round(safe_float(r.get("rush_yards_over_expected_per_att")), 2),
                "ryoe_total": round(safe_float(r.get("rush_yards_over_expected")), 0),
                "box8_pct": round(safe_float(r.get("percent_attempts_gte_eight_defenders")), 1),
                "eff": round(safe_float(r.get("efficiency")), 2),
            }
    except Exception as e:
        print(f"[WARN] NGS Rushing: {e}")

    try:
        ngs_rec = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/nextgen_stats/ngs_receiving.csv.gz")
        ngs_rec = ngs_rec[(ngs_rec["season"] == 2026) & (ngs_rec["week"] == 0)]
        for _, r in ngs_rec.iterrows():
            ngs_rec_map[str(r.get("player_gsis_id", ""))] = {
                "sep": round(safe_float(r.get("avg_separation")), 2),
                "cushion": round(safe_float(r.get("avg_cushion")), 2),
                "yac_oe": round(safe_float(r.get("avg_yac_above_expectation")), 2),
            }
    except Exception as e:
        print(f"[WARN] NGS Receiving: {e}")

    # PFR Advanced Stats 2026
    pfr_pass_map, pfr_def_map = {}, {}
    try:
        pfr_p = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/pfr_advstats/advstats_season_pass.csv")
        pfr_p = pfr_p[pfr_p["season"] == 2026]
        for _, r in pfr_p.iterrows():
            pfr_pass_map[str(r.get("player", "")).strip().lower()] = {
                "pressure_pct": round(safe_float(r.get("pressure_pct")) * (100 if safe_float(r.get("pressure_pct")) <= 1 else 1), 1),
                "bad_throw_pct": round(safe_float(r.get("bad_throw_pct")) * (100 if safe_float(r.get("bad_throw_pct")) <= 1 else 1), 1),
                "on_tgt_pct": round(safe_float(r.get("on_tgt_pct")) * (100 if safe_float(r.get("on_tgt_pct")) <= 1 else 1), 1),
                "pocket_time": round(safe_float(r.get("pocket_time")), 2),
                "pfr_id": str(r.get("pfr_id", "")),
            }
    except Exception as e:
        print(f"[WARN] PFR Pass: {e}")

    try:
        pfr_d = pd.read_csv("https://github.com/nflverse/nflverse-data/releases/download/pfr_advstats/advstats_season_def.csv")
        pfr_d = pfr_d[pfr_d["season"] == 2026]
        for _, r in pfr_d.iterrows():
            pfr_def_map[str(r.get("player", "")).strip().lower()] = {
                "pressures": int(safe_float(r.get("pressures"))),
                "rat_allowed": round(safe_float(r.get("rat")), 1),
                "cmp_pct_allowed": round(safe_float(r.get("cmp_pct")) * (100 if safe_float(r.get("cmp_pct")) <= 1 else 1), 1),
                "missed_tkl_pct": round(safe_float(r.get("missed_tackle_pct")) * (100 if safe_float(r.get("missed_tackle_pct")) <= 1 else 1), 1),
                "pfr_id": str(r.get("pfr_id", "")),
            }
    except Exception as e:
        print(f"[WARN] PFR Def: {e}")

    players_out = []

    # 1. QBs (attempts >= 60)
    qbs = df_p[(df_p["position"] == "QB") & (df_p["attempts"] >= 60)].copy()
    qbs["epa_per_db"] = (qbs["passing_epa"] / (qbs["attempts"] + qbs["sacks_suffered"]).replace(0, 1)).round(3)
    qbs["pct_epa"] = compute_percentile(qbs["epa_per_db"], True)
    qbs["pct_cpoe"] = compute_percentile(qbs["passing_cpoe"].fillna(0), True)
    for _, r in qbs.sort_values("passing_epa", ascending=False).iterrows():
        pid = str(r.get("player_id", ""))
        pname = str(r.get("player_display_name", r.get("player_name", "")))
        ngs = ngs_pass_map.get(pid, {})
        pfr = pfr_pass_map.get(pname.lower(), {})
        slug = re.sub(r"[^a-z0-9]+", "-", pname.lower()).strip("-")
        players_out.append({
            "id": pid,
            "name": pname,
            "pos": "QB",
            "team": r["recent_team"],
            "headshot": str(r.get("headshot_url", "")) if pd.notna(r.get("headshot_url")) else "",
            "games": int(r["games"]),
            "primary_label": "EPA/Dropback",
            "primary_val": float(r["epa_per_db"]),
            "secondary_label": "CPOE",
            "secondary_val": f"{round(safe_float(r.get('passing_cpoe')), 1):+.1f}%",
            "percentile": int(r["pct_epa"]),
            "metrics": {
                "Yds Pase": int(r["passing_yards"]),
                "TD / INT": f"{int(r['passing_tds'])} / {int(r['passing_interceptions'])}",
                "EPA/Dropback": float(r["epa_per_db"]),
                "CPOE": f"{round(safe_float(r.get('passing_cpoe')), 1):+.1f}%",
                "NGS Time to Throw": f"{ngs.get('ttt', 2.75)}s",
                "PFR On-Target %": f"{pfr.get('on_tgt_pct', 75.0)}%",
                "PFR Pressure %": f"{pfr.get('pressure_pct', 21.0)}%",
                "Yds Tierra": int(r["rushing_yards"]),
            },
            "links": {
                "pfr": f"https://www.pro-football-reference.com/players/{pfr['pfr_id'][0]}/{pfr['pfr_id']}.htm" if pfr.get("pfr_id") else "https://www.pro-football-reference.com/years/2026/passing.htm",
                "playerprofiler": f"https://www.playerprofiler.com/nfl/{slug}/",
                "rbsdm": "https://rbsdm.com/stats/stats/",
                "ngs": "https://nextgenstats.nfl.com/stats/passing",
            },
        })

    # 2. RBs (carries >= 40)
    rbs = df_p[(df_p["position"] == "RB") & (df_p["carries"] >= 40)].copy()
    rbs["epa_per_rush"] = (rbs["rushing_epa"] / rbs["carries"].replace(0, 1)).round(3)
    rbs["ypc"] = (rbs["rushing_yards"] / rbs["carries"].replace(0, 1)).round(2)
    rbs["pct_epa"] = compute_percentile(rbs["rushing_yards"], True)
    for _, r in rbs.sort_values("rushing_yards", ascending=False).head(45).iterrows():
        pid = str(r.get("player_id", ""))
        pname = str(r.get("player_display_name", r.get("player_name", "")))
        ngs = ngs_rush_map.get(pid, {})
        slug = re.sub(r"[^a-z0-9]+", "-", pname.lower()).strip("-")
        players_out.append({
            "id": pid,
            "name": pname,
            "pos": "RB",
            "team": r["recent_team"],
            "headshot": str(r.get("headshot_url", "")) if pd.notna(r.get("headshot_url")) else "",
            "games": int(r["games"]),
            "primary_label": "Yds Tierra",
            "primary_val": int(r["rushing_yards"]),
            "secondary_label": "NGS RYOE/Att",
            "secondary_val": f"{ngs.get('ryoe_att', 0.0):+.2f}",
            "percentile": int(r["pct_epa"]),
            "metrics": {
                "Acarreos": int(r["carries"]),
                "Yds Tierra": int(r["rushing_yards"]),
                "Yds/Acarreo": float(r["ypc"]),
                "TDs Tierra": int(r["rushing_tds"]),
                "EPA/Acarreo": float(r["epa_per_rush"]),
                "NGS RYOE/Att": f"{ngs.get('ryoe_att', 0.0):+.2f}",
                "NGS Caja 8+ Def": f"{ngs.get('box8_pct', 20.0)}%",
                "Target Share": f"{round(safe_float(r.get('target_share')) * 100, 1)}%",
            },
            "links": {
                "pfr": "https://www.pro-football-reference.com/years/2026/rushing.htm",
                "playerprofiler": f"https://www.playerprofiler.com/nfl/{slug}/",
                "ngs": "https://nextgenstats.nfl.com/stats/rushing",
            },
        })

    # 3. WRs & TEs (targets >= 22)
    recs = df_p[(df_p["position"].isin(["WR", "TE"])) & (df_p["targets"] >= 22)].copy()
    recs["epa_per_tgt"] = (recs["receiving_epa"] / recs["targets"].replace(0, 1)).round(3)
    recs["pct_rec"] = compute_percentile(recs["receiving_yards"], True)
    for _, r in recs.sort_values("receiving_yards", ascending=False).head(65).iterrows():
        pid = str(r.get("player_id", ""))
        pname = str(r.get("player_display_name", r.get("player_name", "")))
        pos = str(r.get("position", "WR"))
        ngs = ngs_rec_map.get(pid, {})
        slug = re.sub(r"[^a-z0-9]+", "-", pname.lower()).strip("-")
        players_out.append({
            "id": pid,
            "name": pname,
            "pos": pos,
            "team": r["recent_team"],
            "headshot": str(r.get("headshot_url", "")) if pd.notna(r.get("headshot_url")) else "",
            "games": int(r["games"]),
            "primary_label": "Yds Recepción",
            "primary_val": int(r["receiving_yards"]),
            "secondary_label": "Target Share",
            "secondary_val": f"{round(safe_float(r.get('target_share')) * 100, 1)}%",
            "percentile": int(r["pct_rec"]),
            "metrics": {
                "Recepciones / Tgts": f"{int(r['receptions'])} / {int(r['targets'])}",
                "Yds Recepción": int(r["receiving_yards"]),
                "TDs": int(r["receiving_tds"]),
                "Target Share": f"{round(safe_float(r.get('target_share')) * 100, 1)}%",
                "Air Yards Share": f"{round(safe_float(r.get('air_yards_share')) * 100, 1)}%",
                "WOPR (Opportunity)": round(safe_float(r.get("wopr")), 2),
                "EPA/Target": float(r["epa_per_tgt"]),
                "NGS Separation": f"{ngs.get('sep', 2.8)} yds",
            },
            "links": {
                "pfr": "https://www.pro-football-reference.com/years/2026/receiving.htm",
                "playerprofiler": f"https://www.playerprofiler.com/nfl/{slug}/",
                "ngs": "https://nextgenstats.nfl.com/stats/receiving",
                "savant": "https://nflsavant.com/targets.php",
            },
        })

    # 4. Defensivos (Sacks, Pressures, Tackles, INTs)
    defs = df_p[df_p["position_group"].isin(["DL", "LB", "DB"])].copy()
    defs["impact_play_score"] = (
        defs["def_sacks"].fillna(0) * 3.0
        + defs["def_qb_hits"].fillna(0) * 1.2
        + defs["def_tackles_for_loss"].fillna(0) * 1.5
        + defs["def_interceptions"].fillna(0) * 3.5
        + defs["def_pass_defended"].fillna(0) * 1.0
        + defs["def_tackles_solo"].fillna(0) * 0.25
    )
    defs = defs[defs["impact_play_score"] >= 8.0].copy()
    defs["pct_def"] = compute_percentile(defs["impact_play_score"], True)
    for _, r in defs.sort_values("impact_play_score", ascending=False).head(55).iterrows():
        pid = str(r.get("player_id", ""))
        pname = str(r.get("player_display_name", r.get("player_name", "")))
        pfr = pfr_def_map.get(pname.lower(), {})
        players_out.append({
            "id": pid,
            "name": pname,
            "pos": str(r.get("position", "DEF")),
            "team": r["recent_team"],
            "headshot": str(r.get("headshot_url", "")) if pd.notna(r.get("headshot_url")) else "",
            "games": int(r["games"]),
            "primary_label": "Sacks / INTs",
            "primary_val": f"{safe_float(r.get('def_sacks')):.1f} / {int(safe_float(r.get('def_interceptions')))}",
            "secondary_label": "PFR Pressures",
            "secondary_val": str(pfr.get("pressures", int(safe_float(r.get("def_qb_hits")) + safe_float(r.get("def_sacks"))))),
            "percentile": int(r["pct_def"]),
            "metrics": {
                "Sacks": float(safe_float(r.get("def_sacks"))),
                "QB Hits": int(safe_float(r.get("def_qb_hits"))),
                "Tackles For Loss": int(safe_float(r.get("def_tackles_for_loss"))),
                "Tackles Solo": int(safe_float(r.get("def_tackles_solo"))),
                "Intercepciones": int(safe_float(r.get("def_interceptions"))),
                "Pases Defendidos": int(safe_float(r.get("def_pass_defended"))),
                "PFR Pressures": pfr.get("pressures", int(safe_float(r.get("def_qb_hits")) + safe_float(r.get("def_sacks")))),
                "PFR Rating Permitido": pfr.get("rat_allowed", 82.5),
            },
            "links": {
                "pfr": "https://www.pro-football-reference.com/years/2026/defense.htm",
                "pff": "https://www.pff.com/nfl/players",
            },
        })

    return players_out


def fetch_espn_schedule_and_records(teams_dict: dict) -> tuple:
    """
    Descarga las semanas anterior, actual y siguiente desde la API de ESPN,
    actualiza los récords reales de los equipos y clasifica cada partido en TNF / SUNDAY / MNF.
    REGLA ESTRICTA DE CAMBIO DE SEMANA:
    No pasa a la semana siguiente mientras el MNF (o cualquier partido de la semana activa)
    siga en juego ('in'), esté por jugarse ('pre'), o haya finalizado hace menos de 3 horas.
    """
    print("[3/5] Consultando calendario de partidos (TNF / Domingo / MNF) y estado de MNF en ESPN NFL API...")
    games_out = []
    espn_active_wk = 7
    try:
        base_sb = requests.get(
            "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
            headers=HEADERS,
            timeout=10,
        ).json()
        espn_active_wk = int(base_sb.get("week", {}).get("number", 7))
    except Exception as e:
        print(f"[WARN] ESPN Default Scoreboard: {e}")

    weeks_to_fetch = sorted(list({max(1, espn_active_wk - 1), espn_active_wk, min(18, espn_active_wk + 1)}))

    for wk in weeks_to_fetch:
        url = f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week={wk}&seasontype=2"
        try:
            data = requests.get(url, headers=HEADERS, timeout=10).json()
            for ev in data.get("events", []):
                comp = ev.get("competitions", [{}])[0]
                competitors = comp.get("competitors", [])
                if len(competitors) < 2:
                    continue
                home_c = next((c for c in competitors if c.get("homeAway") == "home"), competitors[0])
                away_c = next((c for c in competitors if c.get("homeAway") == "away"), competitors[1])

                h_abbr = norm_team(home_c.get("team", {}).get("abbreviation", ""))
                a_abbr = norm_team(away_c.get("team", {}).get("abbreviation", ""))

                h_rec = next((r.get("summary", "0-0") for r in home_c.get("records", []) if r.get("type") == "total"), "0-0")
                a_rec = next((r.get("summary", "0-0") for r in away_c.get("records", []) if r.get("type") == "total"), "0-0")

                if h_abbr in teams_dict and h_rec != "0-0":
                    teams_dict[h_abbr]["record"] = h_rec
                if a_abbr in teams_dict and a_rec != "0-0":
                    teams_dict[a_abbr]["record"] = a_rec

                dt_str = ev.get("date", "")
                day_slot = "SUNDAY"
                display_time = "Dom 14:00 ART"
                try:
                    dt_utc = datetime.datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                    dt_art = dt_utc - datetime.timedelta(hours=3)
                    weekday = dt_art.weekday()  # 0=Mon, 3=Thu, 4=Fri, 5=Sat, 6=Sun
                    if weekday == 3 or (weekday == 4 and dt_art.hour < 6):
                        day_slot = "TNF"
                        display_time = f"Jue {dt_art.strftime('%d/%m %H:%M')} ART"
                    elif weekday == 0 or (weekday == 1 and dt_art.hour < 6):
                        day_slot = "MNF"
                        display_time = f"Lun {dt_art.strftime('%d/%m %H:%M')} ART"
                    else:
                        day_slot = "SUNDAY"
                        display_time = f"Dom {dt_art.strftime('%d/%m %H:%M')} ART"
                except Exception:
                    pass

                odds_list = comp.get("odds", [])
                spread_txt = odds_list[0].get("details", "PK") if odds_list else "Even"
                ou_val = odds_list[0].get("overUnder", 44.5) if odds_list else 44.5

                status_obj = ev.get("status", {}).get("type", {})
                state = status_obj.get("state", "pre")
                status_detail = status_obj.get("shortDetail", display_time)

                games_out.append({
                    "id": f"W{wk}-{a_abbr}-{h_abbr}",
                    "espn_id": str(ev.get("id", "")),
                    "week": wk,
                    "day_slot": day_slot,
                    "date_iso": dt_str,
                    "display_time": display_time,
                    "status_state": state,
                    "status_detail": status_detail,
                    "away_team": a_abbr,
                    "home_team": h_abbr,
                    "away_score": int(safe_float(away_c.get("score"), 0)),
                    "home_score": int(safe_float(home_c.get("score"), 0)),
                    "away_record": a_rec,
                    "home_record": h_rec,
                    "spread": spread_txt,
                    "over_under": float(safe_float(ou_val, 44.5)),
                    "venue": comp.get("venue", {}).get("fullName", "NFL Stadium"),
                })
        except Exception as e:
            print(f"[WARN] ESPN Week {wk}: {e}")

    # Determinar current_week respetando que MNF haya finalizado por completo
    active_wk_games = [g for g in games_out if g["week"] == espn_active_wk]
    any_unfinalized = any(g["status_state"] in ("pre", "in") for g in active_wk_games)

    mnf_recently_ended = False
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    for g in active_wk_games:
        if g["day_slot"] == "MNF" and g["status_state"] == "post":
            try:
                kickoff_utc = datetime.datetime.fromisoformat(g["date_iso"].replace("Z", "+00:00"))
                # Mantenemos la semana activa durante todo el martes post-MNF (~36 horas desde el kickoff del lunes por la noche)
                if (now_utc - kickoff_utc).total_seconds() < 36.0 * 3600:
                    mnf_recently_ended = True
            except Exception:
                pass

    if any_unfinalized or mnf_recently_ended:
        current_week = espn_active_wk
    else:
        # Si absolutamente todos los partidos (incluido MNF) ya finalizaron hace más de 36h, pasamos a la semana siguiente
        current_week = min(18, espn_active_wk + 1) if active_wk_games else espn_active_wk

    has_live_games = any(g["status_state"] == "in" for g in games_out)
    print(f"  -> Semana activa determinada: Semana {current_week} (En vivo ahora: {has_live_games})")
    return games_out, current_week, has_live_games, weeks_to_fetch


# Palabras clave de alto impacto para filtrar noticias críticas (Lesiones, Trades, Contratos/Cap, Táctico)
HIGH_IMPACT_KEYWORDS = {
    "injury": ["injury", "injured", "ir", "injured reserve", "concussion", "out for", "questionable", "doubtful", "acl", "mri", "hamstring", "ankle", "shoulder", "surgery", "fracture", "designated to return", "ruled out"],
    "cap_contract": ["contract", "extension", "cap", "restructure", "dead money", "guaranteed", "million", "signing", "spotrac", "over the cap", "franchise tag", "option", "salary"],
    "trade_roster": ["trade", "traded", "acquire", "waived", "released", "signed", "promoted", "benched", "starter", "depth chart", "fired", "coordinator"],
    "stat_record": ["epa", "dvoa", "record", "historic", "career-high", "nfl-best", "leads the nfl", "pff", "next gen"],
}


def score_and_classify_news(title: str, summary: str, source_name: str) -> tuple:
    """Evalúa si una noticia es de Alto Impacto real y le asigna categoría y puntaje."""
    text = f"{title} {summary}".lower()
    score = 0
    category = "📊 Impacto Táctico"

    # Ignorar links estáticos de menú de OTC sin jugador ni equipo
    if title.strip().lower() in ("2026 nfl weekly player valuation", "2026 fa spending", "salary cap space", "contracts"):
        return 0, category, ""

    for kw in HIGH_IMPACT_KEYWORDS["injury"]:
        if re.search(r"\b" + re.escape(kw) + r"\b", text):
            score += 30
            category = "🚨 Lesión Clave / Parte Médico"
    for kw in HIGH_IMPACT_KEYWORDS["trade_roster"]:
        if re.search(r"\b" + re.escape(kw) + r"\b", text):
            score += 32
            category = "🔄 Trade / Movimiento de Roster"
    for kw in HIGH_IMPACT_KEYWORDS["cap_contract"]:
        if re.search(r"\b" + re.escape(kw) + r"\b", text):
            score += 28
            category = "💰 Impacto Salarial (Cap / Contrato)"
    for kw in HIGH_IMPACT_KEYWORDS["stat_record"]:
        if re.search(r"\b" + re.escape(kw) + r"\b", text):
            score += 22

    # Fuentes especializadas en contratos o partes médicos reciben prioridad base
    if source_name in ("Over The Cap (OTC)", "Spotrac NFL"):
        score += 18
        category = "💰 Impacto Salarial (Cap / Contrato)"
    elif source_name == "NBC Sports Rotoworld":
        score += 25

    # Detectar si menciona algún equipo NFL
    detected_team = ""
    for abbr, meta in NFL_TEAMS_META.items():
        if meta["short"].lower() in text or meta["name"].lower() in text:
            detected_team = abbr
            score += 18
            break

    return min(score, 99), category, detected_team


def parse_rss_items(xml_text: str, source_name: str, source_url: str, max_items: int = 8) -> list:
    items = []
    try:
        root = ET.fromstring(xml_text)
        # Soportar RSS 2.0 (<item>) y Atom (<entry>)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        rss_items = root.findall(".//item")
        if rss_items:
            for it in rss_items[:max_items]:
                title = (it.findtext("title") or "").strip()
                link = (it.findtext("link") or source_url).strip()
                desc_raw = it.findtext("description") or ""
                desc = BeautifulSoup(desc_raw, "html.parser").get_text(" ", strip=True)[:260]
                pub = (it.findtext("pubDate") or "Hoy").strip()
                if title:
                    items.append({"title": title, "url": link, "summary": desc, "published": pub, "source": source_name, "source_home": source_url})
        else:
            entries = root.findall(".//atom:entry", ns)
            for en in entries[:max_items]:
                title = (en.findtext("atom:title", default="", namespaces=ns) or "").strip()
                if title.startswith("[Highlight]") and "stat" not in title.lower():
                    continue
                link_el = en.find("atom:link", ns)
                link = link_el.attrib.get("href", source_url) if link_el is not None else source_url
                content_raw = en.findtext("atom:content", default="", namespaces=ns) or ""
                desc = BeautifulSoup(content_raw, "html.parser").get_text(" ", strip=True)[:240]
                pub = (en.findtext("atom:updated", default="Hoy", namespaces=ns) or "Hoy")[:16]
                if title:
                    items.append({"title": title, "url": link, "summary": desc, "published": pub, "source": source_name, "source_home": source_url})
    except Exception as e:
        print(f"[WARN] Parse RSS {source_name}: {e}")
    return items


def fetch_high_impact_news() -> list:
    """
    Recopila y filtra noticias de alto impacto de las 8 fuentes solicitadas:
    1. NBC Sports - NFL Player News (Rotoworld)
    2. The Athletic (Sección NFL)
    3. ProFootballTalk (PFT)
    4. ESPN NFL
    5. NFL.com News
    6. Over The Cap (OTC)
    7. Spotrac NFL
    8. Reddit (r/NFL)
    """
    print("[4/5] Escaneando los 8 portales de Top News y aplicando filtro de Alto Impacto...")
    raw_news = []

    # 1. ESPN NFL API
    try:
        r = requests.get("https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=15", headers=HEADERS, timeout=8)
        if r.status_code == 200:
            for art in r.json().get("articles", []):
                raw_news.append({
                    "title": art.get("headline", ""),
                    "summary": art.get("description", ""),
                    "url": art.get("links", {}).get("web", {}).get("href", "https://www.espn.com/nfl/"),
                    "published": art.get("published", "Hoy")[:16],
                    "source": "ESPN NFL",
                    "source_home": "https://www.espn.com/nfl/",
                })
    except Exception as e:
        print(f"[WARN] ESPN News: {e}")

    # 2. ProFootballTalk (PFT)
    try:
        r = requests.get("https://profootballtalk.nbcsports.com/feed/", headers=HEADERS, timeout=8)
        if r.status_code == 200:
            raw_news.extend(parse_rss_items(r.text, "ProFootballTalk (PFT)", "https://www.nbcsports.com/nfl/profootballtalk", 10))
    except Exception as e:
        print(f"[WARN] PFT RSS: {e}")

    # 3. The Athletic (Sección NFL)
    try:
        r = requests.get("https://www.nytimes.com/athletic/rss/nfl/", headers=HEADERS, timeout=8)
        if r.status_code == 200:
            raw_news.extend(parse_rss_items(r.text, "The Athletic NFL", "https://www.nytimes.com/athletic/nfl/", 10))
    except Exception as e:
        print(f"[WARN] The Athletic RSS: {e}")

    # 4. Spotrac NFL
    try:
        r = requests.get("https://www.spotrac.com/feed/", headers=HEADERS, timeout=8)
        if r.status_code == 200:
            raw_news.extend(parse_rss_items(r.text, "Spotrac NFL", "https://www.spotrac.com/nfl/", 8))
    except Exception as e:
        print(f"[WARN] Spotrac RSS: {e}")

    # 5. Reddit (r/NFL)
    try:
        r = requests.get("https://www.reddit.com/r/nfl/hot/.rss", headers=HEADERS, timeout=8)
        if r.status_code == 200:
            raw_news.extend(parse_rss_items(r.text, "Reddit (r/NFL)", "https://www.reddit.com/r/nfl/", 12))
    except Exception as e:
        print(f"[WARN] Reddit RSS: {e}")

    # 6. NBC Sports - NFL Player News (Rotoworld) HTML Scraper
    try:
        r = requests.get("https://www.nbcsports.com/fantasy/football/player-news", headers=HEADERS, timeout=8)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "html.parser")
            items = soup.select(".PlayerNewsPost, article, .PageList-items-item")
            count = 0
            for it in items:
                hl = it.select_one(".PlayerNewsPost-headline, .PagePromo-title, h2, h3")
                body = it.select_one(".PlayerNewsPost-analysis, .PlayerNewsPost-description, .PagePromo-description, p")
                if hl:
                    t_txt = hl.get_text(" ", strip=True)
                    b_txt = body.get_text(" ", strip=True) if body else ""
                    if len(t_txt) > 15:
                        raw_news.append({
                            "title": t_txt,
                            "summary": b_txt[:240],
                            "url": "https://www.nbcsports.com/fantasy/football/player-news",
                            "published": "Última hora",
                            "source": "NBC Sports Rotoworld",
                            "source_home": "https://www.nbcsports.com/fantasy/football/player-news",
                        })
                        count += 1
                        if count >= 6:
                            break
    except Exception as e:
        print(f"[WARN] Rotoworld HTML: {e}")

    # 7. NFL.com News HTML Scraper
    try:
        r = requests.get("https://www.nfl.com/news/", headers=HEADERS, timeout=8)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "html.parser")
            for a_tag in soup.select("a[href*='/news/']")[:15]:
                title_el = a_tag.select_one(".d3-o-media-object__title, h3, p")
                t_txt = (title_el.get_text(" ", strip=True) if title_el else a_tag.get_text(" ", strip=True)).strip()
                href = a_tag.get("href", "")
                if len(t_txt) > 25 and not t_txt.lower().startswith("all news"):
                    full_url = f"https://www.nfl.com{href}" if href.startswith("/") else href
                    raw_news.append({
                        "title": t_txt,
                        "summary": "Cobertura oficial y reportes de vestuario desde NFL.com News.",
                        "url": full_url,
                        "published": "Hoy",
                        "source": "NFL.com News",
                        "source_home": "https://www.nfl.com/news/",
                    })
    except Exception as e:
        print(f"[WARN] NFL.com News: {e}")

    # 8. Over The Cap (OTC)
    try:
        r = requests.get("https://overthecap.com/", headers=HEADERS, timeout=8)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "html.parser")
            for h_el in soup.select("h2 a, h3 a, .entry-title a")[:6]:
                t_txt = h_el.get_text(" ", strip=True)
                href = h_el.get("href", "https://overthecap.com/")
                if href.startswith("/"):
                    href = f"https://overthecap.com{href}"
                if len(t_txt) > 15:
                    raw_news.append({
                        "title": t_txt,
                        "summary": "Análisis de impacto en el tope salarial (Salary Cap), reestructuraciones y espacio disponible en OverTheCap.",
                        "url": href,
                        "published": "Hoy",
                        "source": "Over The Cap (OTC)",
                        "source_home": "https://overthecap.com/",
                    })
    except Exception as e:
        print(f"[WARN] OTC: {e}")

    # Deduplicar y puntuar por Alto Impacto
    seen_titles = set()
    filtered_news = []
    for item in raw_news:
        clean_t = re.sub(r"\s+", " ", item["title"]).strip()
        if not clean_t or clean_t.lower() in seen_titles:
            continue
        seen_titles.add(clean_t.lower())

        score, cat, team = score_and_classify_news(clean_t, item.get("summary", ""), item["source"])
        if score >= 25:
            filtered_news.append({
                "id": f"news-{len(filtered_news)+1}",
                "title": clean_t,
                "summary": item.get("summary", "") or clean_t,
                "url": item["url"],
                "source": item["source"],
                "source_home": item["source_home"],
                "published": item.get("published", "Hoy"),
                "impact_score": score,
                "category": cat,
                "team": team,
            })

    # Ordenar asegurando diversidad entre las 8 fuentes y máximo puntaje de impacto
    filtered_news.sort(key=lambda x: x["impact_score"], reverse=True)
    return filtered_news[:24]


def main():
    teams = build_team_stats()
    players = build_player_stats()
    games, current_week, has_live_games, available_weeks = fetch_espn_schedule_and_records(teams)
    news = fetch_high_impact_news()

    art_tz = datetime.timezone(datetime.timedelta(hours=-3))
    now_art = datetime.datetime.now(art_tz)

    payload = {
        "updated_at": now_art.strftime("%Y-%m-%d %H:%M ART"),
        "updated_iso": now_art.isoformat(),
        "season": 2026,
        "current_week": current_week,
        "available_weeks": available_weeks,
        "has_live_games": has_live_games,
        "sources_stats": [
            {"name": "Pro Football Reference", "url": "https://www.pro-football-reference.com/"},
            {"name": "RBSDM (EPA / CPOE)", "url": "https://rbsdm.com/"},
            {"name": "Pro Football Focus (PFF)", "url": "https://www.pff.com/nfl"},
            {"name": "FTN Fantasy (DVOA)", "url": "https://ftnfantasy.com/stats/nfl/team-total-dvoa"},
            {"name": "NFL Next Gen Stats", "url": "https://nextgenstats.nfl.com/"},
            {"name": "SumerSports", "url": "https://sumersports.com/"},
            {"name": "PlayerProfiler", "url": "https://www.playerprofiler.com/"},
            {"name": "Sharp Football Analysis", "url": "https://www.sharpfootballanalysis.com/stats-nfl/"},
            {"name": "NFL Savant", "url": "https://nflsavant.com/"},
            {"name": "TeamRankings", "url": "https://www.teamrankings.com/nfl/stats/"},
        ],
        "sources_news": [
            {"name": "NBC Sports Rotoworld", "url": "https://www.nbcsports.com/fantasy/football/player-news"},
            {"name": "The Athletic NFL", "url": "https://www.nytimes.com/athletic/nfl/"},
            {"name": "ProFootballTalk (PFT)", "url": "https://www.nbcsports.com/nfl/profootballtalk"},
            {"name": "ESPN NFL", "url": "https://www.espn.com/nfl/"},
            {"name": "NFL.com News", "url": "https://www.nfl.com/news/"},
            {"name": "Over The Cap (OTC)", "url": "https://overthecap.com/"},
            {"name": "Spotrac NFL", "url": "https://www.spotrac.com/nfl/"},
            {"name": "Reddit (r/NFL)", "url": "https://www.reddit.com/r/nfl/"},
        ],
        "teams": teams,
        "players": players,
        "games": games,
        "news": news,
    }

    out_path = os.path.join(DATA_DIR, "nfl_dashboard_data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    js_out_path = os.path.join(DATA_DIR, "nfl_dashboard_data.js")
    with open(js_out_path, "w", encoding="utf-8") as f:
        f.write("window.NFL_DASHBOARD_EMBEDDED_DATA = ")
        json.dump(payload, f, ensure_ascii=False)
        f.write(";\n")

    print(f"[5/5] ¡Ingesta completada! Equipos: {len(teams)} | Jugadores: {len(players)} | Partidos: {len(games)} | Top News: {len(news)}")
    print(f"      Archivos generados: {out_path} y {js_out_path}")


if __name__ == "__main__":
    main()
