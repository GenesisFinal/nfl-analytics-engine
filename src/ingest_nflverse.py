"""nflverse Parquet data ingestion module for Play-by-Play and Rosters.

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

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36 NFLAnalyticsEngine/1.0"
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
    "cpoe",
    "success",
    "yac_epa",
    "qb_dropback",
    "pass_attempt",
    "rush_attempt",
    "sack",
    "complete_pass",
    "incomplete_pass",
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
    """Download nflverse Play-by-Play Parquet for preferred_season with automatic fallback.

    Returns:
        (df, metadata) where metadata documents requested_season, active_season,
        fallback_used, fallback_reason, total_plays, and pbp_url.
    """
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

            metadata: dict[str, Any] = {
                "requested_season": int(preferred_season),
                "active_season": int(season),
                "fallback_used": bool(fallback_used),
                "fallback_reason": str(fallback_reason),
                "total_plays": int(len(df)),
                "pbp_url": url,
            }
            logger.info(
                "Loaded nflverse PBP season %d (%d plays, fallback_used=%s)",
                season,
                len(df),
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


# Compatibility aliases
load_pbp_data = detect_and_load_pbp
load_roster_data = load_rosters
