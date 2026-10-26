"""nflverse Parquet data ingestion module for Play-by-Play, Rosters, Contracts (OTC), NGS & PFR.

Complies strictly with AGENTS.md:
- Downloads official nflverse Parquet releases via HTTPS in memory.
- Automatic fallback from preferred season (e.g. 2026) to latest available season (2025, 2024)
  when HTTP 404 or empty/invalid dataset is encountered, recording metadata.
- Cross-platform path handling via Path(__file__).resolve().parent.parent.
"""

from __future__ import annotations

import io
import logging
from pathlib import Path
from typing import Any

import pandas as pd
import pyarrow.parquet as pq
import requests

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent

PBP_URL_TEMPLATE = (
    "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{season}.parquet"
)
ROSTER_URL_TEMPLATE = (
    "https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_{season}.parquet"
)
CONTRACTS_URL = (
    "https://github.com/nflverse/nflverse-data/releases/download/contracts/historical_contracts.parquet"
)
NGS_URL_TEMPLATE = (
    "https://github.com/nflverse/nflverse-data/releases/download/nextgen_stats/ngs_{stat_type}.parquet"
)
PFR_SEASON_URL_TEMPLATE = (
    "https://github.com/nflverse/nflverse-data/releases/download/pfr_advstats/advstats_season_{stat_type}.parquet"
)
FTN_URL_TEMPLATE = (
    "https://github.com/nflverse/nflverse-data/releases/download/ftn_charting/ftn_charting_{season}.parquet"
)

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36 NFLAnalyticsEngine/2.0"
    ),
    "Accept": "application/octet-stream, */*",
}

PBP_RELEVANT_COLUMNS: list[str] = [
    "play_id",
    "game_id",
    "season",
    "season_type",
    "week",
    "qtr",
    "wp",
    "wpa",
    "epa",
    "qb_epa",
    "cpoe",
    "cp",
    "success",
    "yac_epa",
    "xyac_epa",
    "xyac_mean_yardage",
    "xyac_success",
    "air_epa",
    "comp_air_epa",
    "comp_yac_epa",
    "air_yards",
    "pass_location",
    "pass_length",
    "xpass",
    "pass_oe",
    "shotgun",
    "no_huddle",
    "qb_dropback",
    "qb_scramble",
    "qb_hit",
    "pass_attempt",
    "rush_attempt",
    "sack",
    "complete_pass",
    "incomplete_pass",
    "interception",
    "fumble_lost",
    "passing_yards",
    "rushing_yards",
    "receiving_yards",
    "yards_gained",
    "passer_player_id",
    "passer_player_name",
    "rusher_player_id",
    "rusher_player_name",
    "receiver_player_id",
    "receiver_player_name",
    "posteam",
    "defteam",
    "home_team",
    "away_team",
    "home_score",
    "away_score",
    "desc",
    "play_type",
    "down",
    "ydstogo",
    "yardline_100",
    "first_down",
    "first_down_pass",
    "first_down_rush",
    "third_down_converted",
    "third_down_failed",
    "fourth_down_converted",
    "fourth_down_failed",
    "touchdown",
    "pass_touchdown",
    "rush_touchdown",
    "series_success",
]

REQUIRED_PBP_COLUMNS: tuple[str, ...] = ("epa", "wp", "qtr")


def _read_parquet_bytes(
    raw_bytes: bytes,
    relevant_columns: list[str] | None = None,
) -> pd.DataFrame:
    """Read Parquet bytes into a DataFrame, projecting relevant_columns when available."""
    buffer = io.BytesIO(raw_bytes)
    if relevant_columns:
        try:
            schema = pq.read_schema(buffer)
            schema_names = set(schema.names)
            if len(schema_names) > len(relevant_columns):
                cols_to_load = [c for c in relevant_columns if c in schema_names]
                buffer.seek(0)
                if cols_to_load:
                    return pd.read_parquet(buffer, columns=cols_to_load)
        except Exception:  # noqa: BLE001
            pass
    buffer.seek(0)
    return pd.read_parquet(buffer)


def _validate_pbp_dataframe(df: pd.DataFrame) -> tuple[bool, str]:
    """Validate that a PBP DataFrame is non-empty and contains valid EPA/WP/QTR data."""
    if df is None or len(df) == 0:
        return False, "DataFrame is empty (0 rows)"

    missing_cols = [col for col in REQUIRED_PBP_COLUMNS if col not in df.columns]
    if missing_cols:
        return False, f"Missing required columns: {missing_cols}"

    if df["epa"].dropna().empty:
        return False, "Column 'epa' contains no valid non-null plays"

    return True, "valid"


def detect_and_load_pbp(
    preferred_season: int = 2026,
    fallback_seasons: tuple[int, ...] = (2025, 2024),
    timeout: int = 60,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Download nflverse Play-by-Play Parquet for preferred_season with automatic fallback."""
    seasons_to_try: list[int] = [preferred_season]
    for s in fallback_seasons:
        if s not in seasons_to_try:
            seasons_to_try.append(s)

    failure_reasons: list[str] = []

    for season in seasons_to_try:
        url = PBP_URL_TEMPLATE.format(season=season)
        try:
            logger.info("Attempting to download nflverse PBP for season %d: %s", season, url)
            response = requests.get(url, headers=DEFAULT_HEADERS, timeout=timeout)
            status_code = getattr(response, "status_code", 200)
            if isinstance(status_code, int) and status_code >= 400:
                raise requests.HTTPError(
                    f"HTTP {status_code} for season {season} ({url})",
                    response=response,
                )
            if hasattr(response, "raise_for_status"):
                response.raise_for_status()

            df = _read_parquet_bytes(response.content, relevant_columns=PBP_RELEVANT_COLUMNS)
            if df is not None and not df.empty and "season_type" in df.columns:
                non_pre_mask = df["season_type"].fillna("REG").astype(str).str.upper() != "PRE"
                df = df.loc[non_pre_mask].copy()

            is_valid, validation_msg = _validate_pbp_dataframe(df)
            if not is_valid:
                reason = f"Season {season} invalid PBP data: {validation_msg}"
                logger.warning(reason)
                failure_reasons.append(reason)
                continue

            fallback_used = season != preferred_season
            fallback_reason = (
                "; ".join(failure_reasons)
                if fallback_used
                else "Primary requested season loaded successfully"
            )

            weeks_included = (
                sorted(pd.to_numeric(df["week"], errors="coerce").dropna().astype(int).unique().tolist())
                if "week" in df.columns
                else []
            )
            games_monitored = (
                int(df["game_id"].dropna().nunique())
                if "game_id" in df.columns
                else 0
            )
            season_types = (
                sorted(df["season_type"].dropna().astype(str).unique().tolist())
                if "season_type" in df.columns
                else ["REG"]
            )

            metadata: dict[str, Any] = {
                "requested_season": int(preferred_season),
                "active_season": int(season),
                "fallback_used": bool(fallback_used),
                "fallback_reason": str(fallback_reason),
                "total_plays": int(len(df)),
                "games_monitored": games_monitored,
                "weeks_included": weeks_included,
                "season_types_included": season_types,
                "preseason_excluded": True,
                "pbp_url": url,
            }
            logger.info(
                "Loaded nflverse PBP season %d (%d plays across %d games, weeks=%s, fallback_used=%s)",
                season,
                len(df),
                games_monitored,
                weeks_included,
                fallback_used,
            )
            return df, metadata

        except Exception as exc:  # noqa: BLE001
            reason = f"Season {season} download failed ({exc})"
            logger.warning(reason)
            failure_reasons.append(reason)

    raise RuntimeError(
        f"Failed to load nflverse PBP for seasons {seasons_to_try}. "
        f"Reasons: {'; '.join(failure_reasons)}"
    )


def load_rosters(
    season: int = 2026,
    fallback_seasons: tuple[int, ...] = (2025, 2024),
    timeout: int = 45,
) -> tuple[pd.DataFrame, int]:
    """Download nflverse roster Parquet for season with automatic fallback to fallback_seasons."""
    seasons_to_try: list[int] = [season]
    for s in fallback_seasons:
        if s not in seasons_to_try:
            seasons_to_try.append(s)

    failure_reasons: list[str] = []

    for candidate_season in seasons_to_try:
        url = ROSTER_URL_TEMPLATE.format(season=candidate_season)
        try:
            logger.info(
                "Attempting to download nflverse roster for season %d: %s",
                candidate_season,
                url,
            )
            response = requests.get(url, headers=DEFAULT_HEADERS, timeout=timeout)
            status_code = getattr(response, "status_code", 200)
            if isinstance(status_code, int) and status_code >= 400:
                raise requests.HTTPError(
                    f"HTTP {status_code} for roster season {candidate_season} ({url})",
                    response=response,
                )
            if hasattr(response, "raise_for_status"):
                response.raise_for_status()

            roster_df = _read_parquet_bytes(response.content, relevant_columns=None)
            if roster_df is None or len(roster_df) == 0:
                reason = f"Roster season {candidate_season} is empty (0 rows)"
                logger.warning(reason)
                failure_reasons.append(reason)
                continue

            logger.info(
                "Loaded nflverse roster for season %d (%d rows)",
                candidate_season,
                len(roster_df),
            )
            return roster_df, int(candidate_season)

        except Exception as exc:  # noqa: BLE001
            reason = f"Roster season {candidate_season} failed ({exc})"
            logger.warning(reason)
            failure_reasons.append(reason)

    raise RuntimeError(
        f"Failed to load nflverse rosters for seasons {seasons_to_try}. "
        f"Reasons: {'; '.join(failure_reasons)}"
    )


def load_otc_contracts(timeout: int = 30) -> pd.DataFrame:
    """Download OverTheCap historical_contracts.parquet from nflverse-data (resilient fallback to empty DF)."""
    try:
        response = requests.get(CONTRACTS_URL, headers=DEFAULT_HEADERS, timeout=timeout)
        if getattr(response, "status_code", 500) == 200 and response.content:
            cols = [
                "gsis_id",
                "player",
                "position",
                "team",
                "is_active",
                "year_signed",
                "years",
                "value",
                "apy",
                "guaranteed",
                "apy_cap_pct",
            ]
            return _read_parquet_bytes(response.content, relevant_columns=cols)
    except Exception as exc:  # noqa: BLE001
        logger.warning("OverTheCap contracts download skipped: %s", exc)
    return pd.DataFrame()


def load_ngs_season_averages(season: int = 2025, timeout: int = 25) -> dict[str, dict[str, Any]]:
    """Download Next Gen Stats (passing, receiving, rushing) season averages keyed by player_gsis_id."""
    lookup: dict[str, dict[str, Any]] = {}
    for stat_type in ("passing", "receiving", "rushing"):
        url = NGS_URL_TEMPLATE.format(stat_type=stat_type)
        try:
            resp = requests.get(url, headers=DEFAULT_HEADERS, timeout=timeout)
            if getattr(resp, "status_code", 500) != 200 or not resp.content:
                continue
            df = _read_parquet_bytes(resp.content)
            if df is None or df.empty or "player_gsis_id" not in df.columns:
                continue
            # Filter for requested season (or latest available in file) and week == 0 (season summary)
            if "season" in df.columns:
                avail_seasons = sorted(df["season"].dropna().unique().tolist())
                target_s = season if season in avail_seasons else (avail_seasons[-1] if avail_seasons else season)
                df = df.loc[df["season"] == target_s]
            if "week" in df.columns and (df["week"] == 0).any():
                df = df.loc[df["week"] == 0]

            for _, row in df.iterrows():
                pid = str(row.get("player_gsis_id") or "").strip()
                if not pid:
                    continue
                entry = lookup.setdefault(pid, {})
                if stat_type == "passing":
                    entry["ngs_time_to_throw"] = float(row.get("avg_time_to_throw") or 0.0)
                    entry["ngs_aggressiveness"] = float(row.get("aggressiveness") or 0.0)
                    entry["ngs_completed_air_yards"] = float(row.get("avg_completed_air_yards") or 0.0)
                    entry["ngs_intended_air_yards"] = float(row.get("avg_intended_air_yards") or 0.0)
                elif stat_type == "receiving":
                    entry["ngs_avg_cushion"] = float(row.get("avg_cushion") or 0.0)
                    entry["ngs_avg_separation"] = float(row.get("avg_separation") or 0.0)
                    entry["ngs_yac_above_expectation"] = float(row.get("avg_yac_above_expectation") or 0.0)
                elif stat_type == "rushing":
                    entry["ngs_ryoe_per_att"] = float(row.get("rush_yards_over_expected_per_att") or 0.0)
                    entry["ngs_efficiency"] = float(row.get("efficiency") or 0.0)
                    entry["ngs_eight_box_pct"] = float(row.get("percent_attempts_gte_eight_defenders") or 0.0)
        except Exception as exc:  # noqa: BLE001
            logger.debug("NGS %s download skipped: %s", stat_type, exc)
    return lookup


# Compatibility aliases
load_pbp_data = detect_and_load_pbp
load_roster_data = load_rosters
