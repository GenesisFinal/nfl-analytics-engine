"""ESPN JSON API ingestion module for live scoreboard and win probability analytics.

Complies strictly with AGENTS.md:
- No HTML web scraping (uses official ESPN JSON API endpoints only).
- Automatic fallback from site.api.espn.com to site.web.api.espn.com.
- Extracts critical plays with |delta_wp| >= 0.12 from winprobability arrays.
- Cross-platform path handling via Path(__file__).resolve().parent.parent.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT_PATH = PROJECT_ROOT / "public" / "data" / "live_scoreboard.json"

SCOREBOARD_URL_PRIMARY = (
    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
)
SCOREBOARD_URL_FALLBACK = (
    "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
)

SUMMARY_URL_PRIMARY_TEMPLATE = (
    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={event_id}"
)
SUMMARY_URL_FALLBACK_TEMPLATE = (
    "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={event_id}"
)

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36 NFLAnalyticsEngine/1.0"
    ),
    "Accept": "application/json",
}


_SSL_FALLBACK_ACTIVE = False


def _get_json_with_fallback(
    primary_url: str,
    fallback_url: str,
    timeout: int = 15,
) -> dict[str, Any]:
    """Perform a GET request to primary_url with automatic fallback to fallback_url."""
    global _SSL_FALLBACK_ACTIVE
    last_error: Exception | None = None
    urls = (fallback_url, primary_url) if _SSL_FALLBACK_ACTIVE else (primary_url, fallback_url)
    for url in urls:
        try:
            response = requests.get(url, headers=DEFAULT_HEADERS, timeout=timeout)
            status_code = getattr(response, "status_code", 200)
            if isinstance(status_code, int) and status_code >= 400:
                raise requests.HTTPError(f"HTTP {status_code} for {url}", response=response)
            if hasattr(response, "raise_for_status"):
                response.raise_for_status()
            data = response.json()
            if isinstance(data, dict):
                return data
            raise ValueError(f"Expected JSON object from {url}, got {type(data).__name__}")
        except requests.exceptions.SSLError as exc:
            if url == primary_url:
                _SSL_FALLBACK_ACTIVE = True
            logger.warning("SSL error on endpoint (%s), switching to fallback: %s", url, exc)
            last_error = exc
        except Exception as exc:  # noqa: BLE001
            logger.warning("Endpoint failed (%s): %s", url, exc)
            last_error = exc

    raise RuntimeError(
        f"Both primary and fallback ESPN endpoints failed. Last error: {last_error}"
    ) from last_error


def fetch_scoreboard(timeout: int = 15, week: int | None = None, seasontype: int = 2) -> dict[str, Any]:
    """Fetch the live NFL scoreboard JSON from ESPN with automatic endpoint fallback."""
    suffix = f"?seasontype={seasontype}&week={week}" if week is not None else ""
    return _get_json_with_fallback(
        primary_url=f"{SCOREBOARD_URL_PRIMARY}{suffix}",
        fallback_url=f"{SCOREBOARD_URL_FALLBACK}{suffix}",
        timeout=timeout,
    )


def fetch_game_summary(event_id: str, timeout: int = 15) -> dict[str, Any]:
    """Fetch the game summary and win probability JSON for a specific ESPN event_id."""
    if not event_id:
        raise ValueError("event_id must be a non-empty string")
    primary_url = SUMMARY_URL_PRIMARY_TEMPLATE.format(event_id=event_id)
    fallback_url = SUMMARY_URL_FALLBACK_TEMPLATE.format(event_id=event_id)
    return _get_json_with_fallback(
        primary_url=primary_url,
        fallback_url=fallback_url,
        timeout=timeout,
    )


def _build_play_lookup(summary_data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Build a mapping from play_id to play metadata from drives.previous and drives.current."""
    play_lookup: dict[str, dict[str, Any]] = {}
    drives_obj = summary_data.get("drives")
    if not isinstance(drives_obj, dict):
        return play_lookup

    drive_list: list[dict[str, Any]] = []
    previous_drives = drives_obj.get("previous")
    if isinstance(previous_drives, list):
        drive_list.extend(d for d in previous_drives if isinstance(d, dict))

    current_drive = drives_obj.get("current")
    if isinstance(current_drive, dict):
        drive_list.append(current_drive)
    elif isinstance(current_drive, list):
        drive_list.extend(d for d in current_drive if isinstance(d, dict))

    for drive in drive_list:
        plays = drive.get("plays")
        if not isinstance(plays, list):
            continue
        for play in plays:
            if not isinstance(play, dict):
                continue
            raw_id = play.get("id")
            if raw_id is None:
                continue
            play_id = str(raw_id)

            period_obj = play.get("period")
            if isinstance(period_obj, dict):
                qtr = int(period_obj.get("number", 0) or 0)
            elif isinstance(period_obj, (int, float)):
                qtr = int(period_obj)
            else:
                qtr = int(play.get("qtr", 0) or 0)

            clock_obj = play.get("clock")
            if isinstance(clock_obj, dict):
                clock = str(clock_obj.get("displayValue", "0:00") or "0:00")
            elif isinstance(clock_obj, str):
                clock = clock_obj
            else:
                clock = "0:00"

            description = str(
                play.get("text")
                or play.get("description")
                or play.get("shortText")
                or "Jugada sin descripción"
            ).strip()

            play_lookup[play_id] = {
                "play_id": play_id,
                "qtr": qtr,
                "clock": clock,
                "description": description,
                "home_score": play.get("homeScore"),
                "away_score": play.get("awayScore"),
            }

    return play_lookup


def _extract_all_wp_deltas(summary_data: dict[str, Any]) -> list[dict[str, Any]]:
    """Calculate win probability deltas across all plays in summary_data['winprobability']."""
    if not isinstance(summary_data, dict):
        return []

    wp_array = summary_data.get("winprobability")
    if not isinstance(wp_array, list) or not wp_array:
        return []

    play_lookup = _build_play_lookup(summary_data)
    moments: list[dict[str, Any]] = []
    prev_home_wp = 0.5

    for idx, item in enumerate(wp_array):
        if not isinstance(item, dict):
            continue
        raw_wp = item.get("homeWinPercentage")
        if raw_wp is None:
            continue
        try:
            curr_home_wp = float(raw_wp)
        except (TypeError, ValueError):
            continue

        if curr_home_wp > 1.0:
            curr_home_wp = curr_home_wp / 100.0

        if idx == 0:
            home_wp_before = 0.5
        else:
            home_wp_before = prev_home_wp

        delta_wp = round(curr_home_wp - home_wp_before, 6)
        abs_delta_wp = round(abs(delta_wp), 6)
        prev_home_wp = curr_home_wp

        nested_play = item.get("play") if isinstance(item.get("play"), dict) else {}
        raw_play_id = (
            item.get("playId")
            or item.get("play_id")
            or item.get("id")
            or nested_play.get("id")
            or f"play_{idx}"
        )
        play_id = str(raw_play_id)
        lookup_info = play_lookup.get(play_id, {})

        # Resolve quarter
        qtr = lookup_info.get("qtr")
        if not qtr:
            period_obj = nested_play.get("period") or item.get("period")
            if isinstance(period_obj, dict):
                qtr = int(period_obj.get("number", 0) or 0)
            elif isinstance(period_obj, (int, float)):
                qtr = int(period_obj)
            else:
                qtr = int(item.get("qtr", 0) or 0)

        # Resolve clock
        clock = lookup_info.get("clock")
        if not clock:
            clock_obj = nested_play.get("clock") or item.get("clock")
            if isinstance(clock_obj, dict):
                clock = str(clock_obj.get("displayValue", "0:00") or "0:00")
            elif isinstance(clock_obj, str):
                clock = clock_obj
            else:
                clock = "0:00"

        # Resolve description
        description = lookup_info.get("description")
        if not description:
            description = str(
                nested_play.get("text")
                or item.get("text")
                or item.get("description")
                or "Jugada sin descripción"
            ).strip()

        moments.append(
            {
                "play_id": play_id,
                "qtr": int(qtr),
                "clock": str(clock),
                "description": str(description),
                "home_wp_before": round(home_wp_before, 4),
                "home_wp_after": round(curr_home_wp, 4),
                "delta_wp": round(delta_wp, 4),
                "abs_delta_wp": round(abs_delta_wp, 4),
            }
        )

    return moments


def extract_critical_moments(
    summary_data: dict[str, Any],
    min_delta: float = 0.12,
    top_n: int = 3,
) -> list[dict[str, Any]]:
    """Extract top_n plays with |delta_wp| >= min_delta sorted descending by |delta_wp|."""
    all_moments = _extract_all_wp_deltas(summary_data)
    filtered = [m for m in all_moments if m["abs_delta_wp"] >= min_delta]
    filtered.sort(key=lambda m: m["abs_delta_wp"], reverse=True)
    return filtered[:top_n]


def _parse_team_competitor(competitor: dict[str, Any]) -> dict[str, Any]:
    """Normalize an ESPN competitor object into the standard team schema."""
    team_info = competitor.get("team") if isinstance(competitor.get("team"), dict) else {}
    raw_score = competitor.get("score", 0)
    try:
        score = int(float(raw_score)) if raw_score is not None else 0
    except (TypeError, ValueError):
        score = 0

    logo = team_info.get("logo") or ""
    if not logo and isinstance(team_info.get("logos"), list) and team_info["logos"]:
        first_logo = team_info["logos"][0]
        if isinstance(first_logo, dict):
            logo = str(first_logo.get("href", ""))

    return {
        "id": str(team_info.get("id") or competitor.get("id") or ""),
        "abbreviation": str(team_info.get("abbreviation") or ""),
        "name": str(
            team_info.get("displayName")
            or team_info.get("name")
            or team_info.get("shortDisplayName")
            or ""
        ),
        "score": score,
        "logo": str(logo),
    }


def ingest_espn_scoreboard(
    output_path: Path | str | None = None,
) -> dict[str, Any]:
    """Fetch ESPN scoreboard + game summaries and persist public/data/live_scoreboard.json."""
    target_path = Path(output_path) if output_path is not None else DEFAULT_OUTPUT_PATH
    scoreboard_raw = fetch_scoreboard()

    season_obj = scoreboard_raw.get("season") if isinstance(scoreboard_raw.get("season"), dict) else {}
    week_obj = scoreboard_raw.get("week") if isinstance(scoreboard_raw.get("week"), dict) else {}

    season = int(season_obj.get("year") or 2026)
    week = int(week_obj.get("number") or 1)

    events = scoreboard_raw.get("events")
    if not isinstance(events, list):
        events = []

    # Si todos los partidos de la semana en curso están en estado 'pre' (ej. martes/miércoles)
    # y week > 1, cargar también la semana inmediata anterior para contar con partidos
    # finalizados reales y sus Jugadas Bisagra (|delta_wp| >= 0.12).
    def _is_pre_event(ev: dict[str, Any]) -> bool:
        st = ev.get("status", {})
        if not isinstance(st, dict):
            return True
        tp = st.get("type", {})
        return isinstance(tp, dict) and str(tp.get("state", "pre")) == "pre"

    if events and week > 1 and all(_is_pre_event(ev) for ev in events if isinstance(ev, dict)):
        try:
            prev_sb = fetch_scoreboard(week=week - 1, seasontype=int(season_obj.get("type") or 2))
            prev_events = prev_sb.get("events")
            if isinstance(prev_events, list) and prev_events:
                logger.info(
                    "All Week %d games are pre-kickoff; prepending %d completed games from Week %d",
                    week,
                    len(prev_events),
                    week - 1,
                )
                events = prev_events + events
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not fetch previous week %d scoreboard: %s", week - 1, exc)

    games: list[dict[str, Any]] = []

    for event in events:
        if not isinstance(event, dict):
            continue

        event_id = str(event.get("id") or "")
        if not season_obj and isinstance(event.get("season"), dict):
            season = int(event["season"].get("year") or season)
        if not week_obj and isinstance(event.get("week"), dict):
            week = int(event["week"].get("number") or week)

        competitions = event.get("competitions")
        comp = competitions[0] if isinstance(competitions, list) and competitions else {}
        if not isinstance(comp, dict):
            comp = {}

        status_raw = event.get("status") if isinstance(event.get("status"), dict) else comp.get("status", {})
        if not isinstance(status_raw, dict):
            status_raw = {}
        status_type = status_raw.get("type") if isinstance(status_raw.get("type"), dict) else {}

        state = str(status_type.get("state") or "pre")
        detail = str(
            status_type.get("shortDetail")
            or status_type.get("detail")
            or status_type.get("description")
            or ""
        )
        period = int(status_raw.get("period") or 0)
        clock = str(status_raw.get("displayClock") or "0:00")
        completed = bool(status_type.get("completed", False))

        competitors = comp.get("competitors") if isinstance(comp.get("competitors"), list) else []
        home_comp: dict[str, Any] = {}
        away_comp: dict[str, Any] = {}
        for c in competitors:
            if not isinstance(c, dict):
                continue
            if c.get("homeAway") == "home":
                home_comp = c
            elif c.get("homeAway") == "away":
                away_comp = c

        home_team = _parse_team_competitor(home_comp)
        away_team = _parse_team_competitor(away_comp)

        summary_data: dict[str, Any] = {}
        if event_id:
            try:
                summary_data = fetch_game_summary(event_id)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Could not fetch summary for event %s: %s", event_id, exc)

        critical_moments = extract_critical_moments(summary_data, min_delta=0.12, top_n=3)
        all_moments = _extract_all_wp_deltas(summary_data)

        if critical_moments:
            hinge_play: dict[str, Any] | None = {
                **critical_moments[0],
                "exceeds_threshold": True,
            }
        elif all_moments:
            best_moment = max(all_moments, key=lambda m: m["abs_delta_wp"])
            hinge_play = {
                **best_moment,
                "exceeds_threshold": False,
            }
        else:
            hinge_play = None

        # Current/final win probability
        if all_moments:
            home_wp = round(float(all_moments[-1]["home_wp_after"]), 4)
            away_wp = round(1.0 - home_wp, 4)
        elif completed:
            if home_team["score"] > away_team["score"]:
                home_wp, away_wp = 1.0, 0.0
            elif away_team["score"] > home_team["score"]:
                home_wp, away_wp = 0.0, 1.0
            else:
                home_wp, away_wp = 0.5, 0.5
        else:
            home_wp, away_wp = 0.5, 0.5

        short_name = str(
            event.get("shortName")
            or f"{away_team['abbreviation']} @ {home_team['abbreviation']}"
        )

        games.append(
            {
                "event_id": event_id,
                "name": str(event.get("name") or short_name),
                "short_name": short_name,
                "date": str(event.get("date") or ""),
                "status": {
                    "state": state,
                    "detail": detail,
                    "period": period,
                    "clock": clock,
                    "completed": completed,
                },
                "home_team": home_team,
                "away_team": away_team,
                "win_probability": {
                    "home_wp": home_wp,
                    "away_wp": away_wp,
                },
                "critical_moments": critical_moments,
                "hinge_play": hinge_play,
            }
        )

    payload: dict[str, Any] = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": "ESPN JSON API",
        "season": season,
        "week": week,
        "games": games,
    }

    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    logger.info("Saved ESPN scoreboard with %d games to %s", len(games), target_path)
    return payload


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    ingest_espn_scoreboard()
