"""ESPN JSON API ingestion module for live scoreboard and win probability analytics.

Complies strictly with AGENTS.md:
- No HTML web scraping (uses official ESPN JSON API endpoints only).
- Automatic fallback from site.api.espn.com to site.web.api.espn.com.
- Extracts critical plays with |delta_wp| >= 0.12 from winprobability arrays.
- Cross-platform path handling via Path(__file__).resolve().parent.parent.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
import re
from typing import Any
from urllib.parse import quote_plus

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


import shutil
import subprocess

_SSL_FALLBACK_ACTIVE = False
_USE_CURL_ON_SSL_ERROR = False


def _fetch_json_via_curl(url: str, timeout: int = 15) -> dict[str, Any]:
    """Fallback using OS native TLS (Schannel on Windows) when Python OpenSSL hits SSLEOFError."""
    curl_bin = shutil.which("curl.exe") or shutil.which("curl")
    if not curl_bin:
        raise RuntimeError("curl binary not found for TLS fallback")
    proc = subprocess.run(
        [
            curl_bin,
            "-sL",
            "--max-time",
            str(timeout),
            "-H",
            f"User-Agent: {DEFAULT_HEADERS['User-Agent']}",
            "-H",
            "Accept: application/json",
            url,
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if proc.returncode != 0 or not proc.stdout.strip():
        raise RuntimeError(f"curl failed ({proc.returncode}) for {url}: {proc.stderr}")
    data = json.loads(proc.stdout)
    if isinstance(data, dict):
        return data
    raise ValueError(f"Expected JSON object from {url}")


def _get_json_with_fallback(
    primary_url: str,
    fallback_url: str,
    timeout: int = 15,
) -> dict[str, Any]:
    """Perform a GET request to primary_url with automatic fallback to fallback_url."""
    global _SSL_FALLBACK_ACTIVE, _USE_CURL_ON_SSL_ERROR
    last_error: Exception | None = None
    urls = (fallback_url, primary_url) if _SSL_FALLBACK_ACTIVE else (primary_url, fallback_url)
    for url in urls:
        if _USE_CURL_ON_SSL_ERROR and getattr(requests.get, "__module__", "").startswith("requests"):
            try:
                return _fetch_json_via_curl(url, timeout=timeout)
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                continue
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
            logger.warning("SSL error on endpoint (%s), trying OS TLS fallback: %s", url, exc)
            try:
                data = _fetch_json_via_curl(url, timeout=timeout)
                _USE_CURL_ON_SSL_ERROR = True
                return data
            except Exception as curl_exc:  # noqa: BLE001
                last_error = curl_exc
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


_GLOBAL_PLAYER_LOOKUP: dict[str, str] | None = None


def _get_global_player_lookup() -> dict[str, str]:
    """Load a fallback abbreviated-name -> full-name map from player_rankings.json if available."""
    global _GLOBAL_PLAYER_LOOKUP
    if _GLOBAL_PLAYER_LOOKUP is not None:
        return _GLOBAL_PLAYER_LOOKUP
    lookup: dict[str, str] = {}
    rankings_path = PROJECT_ROOT / "public" / "data" / "player_rankings.json"
    if rankings_path.exists():
        try:
            data = json.loads(rankings_path.read_text(encoding="utf-8"))
            for p in data.get("players", []):
                full = str(p.get("player_name") or p.get("name") or "").strip()
                if not full or " " not in full:
                    continue
                parts = full.split()
                first_init = parts[0][0].lower()
                last_name = parts[-1].lower()
                lookup.setdefault(f"{first_init}.{last_name}", full)
                lookup.setdefault(last_name, full)
        except Exception:  # noqa: BLE001
            pass
    _GLOBAL_PLAYER_LOOKUP = lookup
    return lookup


def _build_player_name_lookup(summary_data: dict[str, Any]) -> dict[str, str]:
    """Build a game-specific lookup mapping 'S.Darnold' / 'K.Abrams-Draine' -> 'Sam Darnold' / 'Kris Abrams-Draine'."""
    lookup = dict(_get_global_player_lookup())
    if not isinstance(summary_data, dict):
        return lookup

    def _register_full_name(full_name: str) -> None:
        clean = str(full_name or "").strip()
        if not clean or " " not in clean:
            return
        parts = clean.split()
        first_init = parts[0][0].lower()
        last_raw = parts[-1]
        # Ignore generational suffixes when building last-name key if possible
        if last_raw.upper().rstrip(".") in {"JR", "SR", "II", "III", "IV", "V"} and len(parts) >= 3:
            last_key = parts[-2].lower()
        else:
            last_key = last_raw.lower()
        lookup[f"{first_init}.{last_key}"] = clean
        lookup[f"{first_init}.{last_raw.lower()}"] = clean
        lookup.setdefault(last_key, clean)

    # 1. From boxscore.players
    boxscore = summary_data.get("boxscore")
    if isinstance(boxscore, dict):
        for team_bx in boxscore.get("players") or []:
            if not isinstance(team_bx, dict):
                continue
            for stat_grp in team_bx.get("statistics") or []:
                if not isinstance(stat_grp, dict):
                    continue
                for ath_entry in stat_grp.get("athletes") or []:
                    if not isinstance(ath_entry, dict):
                        continue
                    ath = ath_entry.get("athlete")
                    if isinstance(ath, dict):
                        disp = str(ath.get("displayName") or ath.get("fullName") or "").strip()
                        first = str(ath.get("firstName") or "").strip()
                        last = str(ath.get("lastName") or "").strip()
                        if disp:
                            _register_full_name(disp)
                        if first and last:
                            full_fl = disp or f"{first} {last}"
                            lookup[f"{first[0].lower()}.{last.lower()}"] = full_fl
                            lookup.setdefault(last.lower(), full_fl)

    # 2. From scoringPlays and leaders
    for sp in summary_data.get("scoringPlays") or []:
        if isinstance(sp, dict):
            for a_item in sp.get("athletesInvolved") or []:
                if isinstance(a_item, dict):
                    _register_full_name(str(a_item.get("displayName") or a_item.get("shortName") or ""))

    # 3. From article.story <a href=".../nfl/player/_/id/...">Full Name</a>
    article = summary_data.get("article")
    if isinstance(article, dict):
        story = str(article.get("story") or "")
        for m in re.finditer(r"nfl/player/_/id/\d+/[^\"']+[\"']>([^<]+)</a>", story, flags=re.IGNORECASE):
            _register_full_name(m.group(1))

    return lookup


def _is_non_play_text(description: str, qtr: int = 1) -> bool:
    """Return True if a play text is an administrative marker (END GAME, Timeout, Two-Minute Warning, empty)."""
    desc = str(description or "").strip().upper()
    if not desc or "SIN DESCRIPCI" in desc:
        return True
    if desc in {"END GAME", "END OF GAME", "END PERIOD", "END QUARTER", "TWO-MINUTE WARNING", "OFFICIAL TIMEOUT"}:
        return True
    if desc.startswith("END QUARTER") or desc.startswith("END PERIOD") or desc.startswith("END OF "):
        return True
    if desc.startswith("TIMEOUT ") or desc.startswith("TIMEOUT #") or "TWO-MINUTE WARNING" in desc:
        return True
    if desc.startswith("INJURY TIMEOUT") or desc.startswith("TV TIMEOUT"):
        return True
    return False


def _build_play_lookup(summary_data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Build a mapping from play_id to play metadata from drives.previous and drives.current.

    Also links administrative markers (such as END GAME or END QUARTER) to the immediately
    preceding on-field play in the same drive so walk-off plays (e.g. a game-winning OT FG
    whose 100% WP is recorded on the END GAME row) are preserved with their real play text.
    """
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
        last_real_play_info: dict[str, Any] | None = None
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

            # Extract play-level video URL if present in the play object
            play_video_url = ""
            raw_video = play.get("video") or play.get("media")
            if isinstance(raw_video, dict):
                play_video_url = _extract_url_from_video_obj(raw_video)
            elif isinstance(play.get("links"), list):
                for lnk in play["links"]:
                    if isinstance(lnk, dict) and lnk.get("href"):
                        rel = lnk.get("rel") or []
                        if any("video" in str(r).lower() or "highlight" in str(r).lower() for r in rel):
                            play_video_url = str(lnk["href"])
                            break

            entry: dict[str, Any] = {
                "play_id": play_id,
                "qtr": qtr,
                "clock": clock,
                "description": description,
                "home_score": play.get("homeScore"),
                "away_score": play.get("awayScore"),
                "video_url": play_video_url,
            }
            if _is_non_play_text(description, qtr) and last_real_play_info is not None:
                entry["preceding_real_play"] = dict(last_real_play_info)
            else:
                last_real_play_info = entry

            play_lookup[play_id] = entry

    return play_lookup


def _extract_url_from_video_obj(video_obj: dict[str, Any]) -> str:
    """Extract the best playable or web URL from an ESPN video/highlight dictionary."""
    if not isinstance(video_obj, dict):
        return ""
    links = video_obj.get("links")
    if isinstance(links, dict):
        source = links.get("source")
        if isinstance(source, dict):
            for quality in ("HD", "full", "mezzanine", "flash", "hds"):
                q_obj = source.get(quality)
                if isinstance(q_obj, dict) and q_obj.get("href"):
                    return str(q_obj["href"]).strip()
            if source.get("href"):
                return str(source["href"]).strip()
        web = links.get("web")
        if isinstance(web, dict) and web.get("href"):
            return str(web["href"]).strip()
        mobile = links.get("mobile")
        if isinstance(mobile, dict) and mobile.get("href"):
            return str(mobile["href"]).strip()
    for direct_key in ("videoUrl", "url", "href"):
        val = video_obj.get(direct_key)
        if isinstance(val, str) and val.startswith("http"):
            return val.strip()
    return ""


def _extract_story_video_clips(summary_data: dict[str, Any]) -> list[dict[str, str]]:
    """Extract direct single-play video clips (e.g. x.com/NFL/status/..., espn.com/video/clip/...) embedded in article.story."""
    clips: list[dict[str, str]] = []
    if not isinstance(summary_data, dict):
        return clips
    article = summary_data.get("article")
    if not isinstance(article, dict):
        return clips
    story = str(article.get("story") or "")
    if not story:
        return clips

    paragraphs = re.split(r"\n\s*\n|<p>|<\s*hl2\s*>", story)
    for para in paragraphs:
        # Split compound sentences on ' and ' when another clause follows so links bind only to their own play clause
        for m in re.finditer(r"<a\s+href=[\"'](https?://[^\"']+)[\"'][^>]*>([^<]+)</a>", para, flags=re.IGNORECASE):
            href = m.group(1).strip()
            anchor_text = m.group(2).strip()
            lower_href = href.lower()
            is_clip = (
                "/status/" in lower_href
                or "espn.com/video/clip" in lower_href
                or "youtube.com/watch" in lower_href
                or "youtu.be/" in lower_href
                or "nfl.com/videos" in lower_href
            )
            if is_clip:
                start_idx = max(0, m.start() - 120)
                end_idx = min(len(para), m.end() + 90)
                local_raw = para[start_idx:end_idx]
                # Truncate at ' and ' after the anchor to avoid bleeding into the next play in the sentence
                before_part = re.sub(r"<[^>]+>", " ", para[start_idx : m.start()])
                after_part = re.sub(r"<[^>]+>", " ", para[m.end() : end_idx])
                after_part = re.split(r"\band\b|\bwhile\b|;", after_part, maxsplit=1)[0]
                before_part = re.split(r"\band\b|;", before_part)[-1]
                local_clause = re.sub(r"\s+", " ", f"{before_part} {anchor_text} {after_part}").strip()
                clips.append(
                    {
                        "video_url": href,
                        "video_title": f"Clip Oficial: {anchor_text}",
                        "video_description": local_clause,
                        "video_source": "Clip Oficial @NFL / ESPN",
                    }
                )
    return clips


def _extract_video_catalog(
    summary_data: dict[str, Any],
    comp_data: dict[str, Any] | None = None,
) -> tuple[dict[str, dict[str, str]], list[dict[str, str]]]:
    """Collect official video clips from summary.videos, article.video, competition.highlights, and article.story."""
    by_play_id: dict[str, dict[str, str]] = {}
    all_videos: list[dict[str, str]] = []

    raw_lists: list[Any] = []
    if isinstance(summary_data, dict):
        raw_lists.append(summary_data.get("videos"))
        article = summary_data.get("article")
        if isinstance(article, dict):
            raw_lists.append(article.get("video"))
    if isinstance(comp_data, dict):
        raw_lists.append(comp_data.get("highlights"))

    for raw_list in raw_lists:
        if not isinstance(raw_list, list):
            continue
        for vid in raw_list:
            if not isinstance(vid, dict):
                continue
            url = _extract_url_from_video_obj(vid)
            if not url:
                continue
            title = str(vid.get("headline") or vid.get("title") or vid.get("name") or "").strip()
            desc = str(vid.get("description") or vid.get("caption") or "").strip()
            thumb = str(vid.get("thumbnail") or "").strip()
            entry = {
                "video_url": url,
                "video_title": title or desc or "Clip Oficial ESPN",
                "video_description": desc,
                "video_thumbnail": thumb,
                "video_source": "ESPN Video Oficial",
            }
            all_videos.append(entry)
            for pid_key in ("playId", "play_id", "id"):
                pid_val = vid.get(pid_key)
                if pid_val is not None:
                    by_play_id[str(pid_val)] = entry

    # Append direct single-play clips embedded in the official game recap story
    story_clips = _extract_story_video_clips(summary_data)
    all_videos.extend(story_clips)

    return by_play_id, all_videos


def _extract_game_links(
    summary_data: dict[str, Any],
    event_data: dict[str, Any] | None = None,
    event_id: str = "",
) -> dict[str, str]:
    """Extract official ESPN Play-by-Play, Recap, and Gamecast URLs for the event."""
    links_found: dict[str, str] = {}
    link_lists: list[Any] = []
    if isinstance(summary_data, dict):
        header = summary_data.get("header")
        if isinstance(header, dict):
            link_lists.append(header.get("links"))
    if isinstance(event_data, dict):
        link_lists.append(event_data.get("links"))

    for l_list in link_lists:
        if not isinstance(l_list, list):
            continue
        for item in l_list:
            if not isinstance(item, dict) or not item.get("href"):
                continue
            href = str(item["href"]).strip()
            rels = [str(r).lower() for r in (item.get("rel") or [])]
            if "pbp" in rels and "pbp" not in links_found:
                links_found["pbp"] = href
            elif "recap" in rels and "recap" not in links_found:
                links_found["recap"] = href
            elif "summary" in rels and "summary" not in links_found:
                links_found["summary"] = href

    if event_id:
        links_found.setdefault("pbp", f"https://www.espn.com/nfl/playbyplay/_/gameId/{event_id}")
        links_found.setdefault("recap", f"https://www.espn.com/nfl/recap?gameId={event_id}")
        links_found.setdefault("summary", f"https://www.espn.com/nfl/game/_/gameId/{event_id}")

    return links_found


def _resolve_player_token(raw_token: str, player_lookup: dict[str, str] | None = None) -> str:
    """Resolve an abbreviated player token like 'S.Darnold' or 'K.Abrams-Draine' to full name."""
    token = str(raw_token or "").strip()
    if not token:
        return ""
    # Strip team prefix like 'NO-C.Young' -> 'C.Young'
    if "-" in token and re.match(r"^[A-Z]{2,3}-[A-Z]\.", token):
        token = token.split("-", 1)[1].strip()
    normalized = re.sub(r"\s+", "", token).lower()
    surname = token.split(".", 1)[-1].strip() if "." in token else token
    lookup = player_lookup if player_lookup is not None else _get_global_player_lookup()
    if normalized in lookup:
        return lookup[normalized]
    if surname.lower() in lookup:
        return lookup[surname.lower()]
    return surname


def _parse_play_search_descriptor(
    description: str,
    player_lookup: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Parse play-by-play text by football role to extract exact playmakers, yardage, and action.

    Crucially avoids misleading tokens:
    - On interceptions, extracts the INTERCEPTOR and the PASSER (ignoring the 'intended for' target).
    - On field goals, extracts ONLY the KICKER and yardage (ignoring 'Center-...' and 'Holder-...').
    - On fumbles, extracts the RECOVERER / FORCER and FUMBLER (ignoring unrelated tacklers).
    """
    raw = str(description or "").strip()
    # Strip long snapper, holder, punter metadata and penalty clauses
    cleaned = re.sub(r"\b(?:Center|Holder|Punter)-[A-Z]{1,2}\.\s?[A-Za-z'-]+", " ", raw, flags=re.IGNORECASE)
    cleaned = re.sub(r"Penalty on[^.]*\.", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\((?:Shotgun|No Huddle|No Huddle,\s*Shotgun|Under Center|Wildcat)\)", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    lower = cleaned.lower()

    name_pat = r"\b(?:[A-Z]{2,3}-)?[A-Z]{1,2}\.\s?[A-Za-z'-]{2,}\b"

    # 1. INTERCEPTION: prioritize interceptor + passer (never 'intended for' target)
    if "intercepted" in lower:
        int_match = re.search(rf"intercepted\s+by\s+({name_pat})", cleaned, flags=re.IGNORECASE)
        passer_match = re.search(rf"({name_pat})\s+pass\b", cleaned, flags=re.IGNORECASE)
        interceptor = _resolve_player_token(int_match.group(1), player_lookup) if int_match else ""
        passer = _resolve_player_token(passer_match.group(1), player_lookup) if passer_match else ""
        actors = [p for p in (interceptor, passer) if p]
        is_td = "touchdown" in lower
        action = "pick six interception touchdown" if is_td else "interception"
        label = (
            f"{interceptor or 'Defensa'} INT a {passer}"
            if passer
            else f"{interceptor or 'Jugada'} Intercepcion"
        )
        return {
            "primary_actors": actors,
            "action_phrase": action,
            "play_label": label.strip(),
            "yardage": None,
        }

    # 2. FIELD GOAL: only kicker + yardage
    fg_match = re.search(rf"({name_pat})\s+(\d+)\s+yard\s+field\s+goal", cleaned, flags=re.IGNORECASE)
    if fg_match or "field goal" in lower:
        kicker = _resolve_player_token(fg_match.group(1), player_lookup) if fg_match else ""
        yds = int(fg_match.group(2)) if fg_match else None
        if not kicker:
            first_p = re.search(name_pat, cleaned)
            kicker = _resolve_player_token(first_p.group(0), player_lookup) if first_p else ""
        yds_str = f"{yds} yard " if yds else ""
        if "blocked" in lower:
            action = f"{yds_str}blocked field goal".strip()
            label = f"{kicker} FG Bloqueado ({yds or ''} yds)".strip()
        elif "no good" in lower or "missed" in lower:
            action = f"{yds_str}missed field goal".strip()
            label = f"{kicker} FG Fallado ({yds or ''} yds)".strip()
        else:
            action = f"{yds_str}field goal".strip()
            label = f"{kicker} FG {yds or ''} yds".strip()
        return {
            "primary_actors": [kicker] if kicker else [],
            "action_phrase": action,
            "play_label": label,
            "yardage": yds,
        }

    # 3. FUMBLE: fumbler + recoverer/forcer
    if "fumble" in lower:
        pre_fumble = re.split(r"\bfumbles\b", cleaned, maxsplit=1, flags=re.IGNORECASE)[0]
        pre_no_parens = re.sub(r"\([^)]*\)", " ", pre_fumble)
        first_p = re.search(name_pat, pre_no_parens)
        fumbler = _resolve_player_token(first_p.group(0), player_lookup) if first_p else ""
        rec_match = re.search(rf"recovered\s+by\s+({name_pat})", cleaned, flags=re.IGNORECASE)
        forced_match = re.search(rf"fumbles\s*\(({name_pat})\)", cleaned, flags=re.IGNORECASE)
        recoverer = _resolve_player_token(rec_match.group(1), player_lookup) if rec_match else ""
        forcer = _resolve_player_token(forced_match.group(1), player_lookup) if forced_match else ""
        second_actor = recoverer or forcer
        actors = [p for p in (fumbler, second_actor) if p and p != fumbler]
        if fumbler and fumbler not in actors:
            actors.insert(0, fumbler)
        action = "fumble return touchdown" if "touchdown" in lower else "fumble"
        label = f"Fumble: {' / '.join(actors[:2])}" if actors else "Fumble Recuperado"
        return {
            "primary_actors": actors[:2],
            "action_phrase": action,
            "play_label": label,
            "yardage": None,
        }

    # 4. PASS PLAY (Touchdown or Big Completion / Incomplete)
    if re.search(r"\bpass\b", lower):
        passer_match = re.search(rf"({name_pat})\s+pass\b", cleaned, flags=re.IGNORECASE)
        rec_match = re.search(rf"\bpass\b.*?\b(?:to|intended\s+for)\s+({name_pat})", cleaned, flags=re.IGNORECASE)
        yds_match = re.search(r"\bfor\s+(\d+)\s+yards?\b", cleaned, flags=re.IGNORECASE)
        passer = _resolve_player_token(passer_match.group(1), player_lookup) if passer_match else ""
        receiver = _resolve_player_token(rec_match.group(1), player_lookup) if rec_match else ""
        yds = int(yds_match.group(1)) if yds_match else None
        actors = [p for p in (passer, receiver) if p]
        if "touchdown" in lower:
            action = f"{yds} yard touchdown".strip() if yds else "touchdown pass"
            label = f"{passer} a {receiver} TD ({yds} yds)" if yds else f"{passer} a {receiver} TD"
        elif "incomplete" in lower:
            action = "4th down incomplete pass" if "4th" in lower else "incomplete pass"
            label = f"Pase incompleto: {passer} a {receiver}".strip()
        else:
            action = f"{yds} yard catch" if yds else "completion"
            label = f"{passer} a {receiver} ({yds} yds)" if yds else f"{passer} a {receiver}"
        return {
            "primary_actors": actors,
            "action_phrase": action,
            "play_label": label,
            "yardage": yds,
        }

    # 5. SACK
    if "sacked" in lower:
        qb_match = re.search(rf"({name_pat})\s+sacked\b", cleaned, flags=re.IGNORECASE)
        sacker_match = re.search(rf"sacked\b.*?\(({name_pat})", cleaned, flags=re.IGNORECASE)
        qb = _resolve_player_token(qb_match.group(1), player_lookup) if qb_match else ""
        sacker = _resolve_player_token(sacker_match.group(1), player_lookup) if sacker_match else ""
        actors = [p for p in (sacker, qb) if p]
        label = f"{sacker or 'Defensa'} captura a {qb}".strip()
        return {
            "primary_actors": actors,
            "action_phrase": "sack",
            "play_label": label,
            "yardage": None,
        }

    # 6. RUSH / PUNT RETURN / KICKOFF RETURN / OTHER
    no_parens = re.sub(r"\([^)]*\)", " ", cleaned)
    found_names = re.findall(name_pat, no_parens)
    primary = _resolve_player_token(found_names[0], player_lookup) if found_names else ""
    yds_match = re.search(r"\bfor\s+(\d+)\s+yards?\b", cleaned, flags=re.IGNORECASE)
    yds = int(yds_match.group(1)) if yds_match else None
    if "touchdown" in lower:
        if "punt" in lower or "kick" in lower:
            action = f"{yds} yard return touchdown" if yds else "return touchdown"
        else:
            action = f"{yds} yard touchdown run" if yds else "touchdown run"
        label = f"{primary} TD ({yds or 1} yds)"
    elif "punt" in lower:
        action = "punt return"
        label = f"Despeje / Regreso: {primary}"
    else:
        action = f"{yds} yard run" if yds and yds >= 10 else "run"
        label = f"Acarreo: {primary} ({yds} yds)" if yds else f"Jugada: {primary}"

    return {
        "primary_actors": [primary] if primary else [],
        "action_phrase": action,
        "play_label": label.strip(),
        "yardage": yds,
    }


def _build_play_search_keywords(
    description: str,
    player_lookup: dict[str, str] | None = None,
) -> str:
    """Return precise player full names + football action for a play description."""
    desc_info = _parse_play_search_descriptor(description, player_lookup)
    parts = list(desc_info["primary_actors"]) + [desc_info["action_phrase"]]
    return " ".join(p for p in parts if p).strip()


def _team_nickname(team: dict[str, Any]) -> str:
    """Extract the short franchise nickname (e.g. 'Seattle Seahawks' -> 'Seahawks') to avoid matching full-game recap titles."""
    full = str(team.get("name") or "").strip()
    abbr = str(team.get("abbreviation") or "").strip()
    if full and " " in full:
        return full.split()[-1]
    return full or abbr


def _is_direct_clip_url(url: str) -> bool:
    """Return True only if url is a direct clip/video URL and NOT a search results page."""
    clean = str(url or "").strip().lower()
    if not clean.startswith("http"):
        return False
    if "youtube.com/results" in clean or "x.com/search" in clean or "google.com/search" in clean:
        return False
    return True


def _enrich_moment_with_video_links(
    moment: dict[str, Any],
    event_id: str,
    away_team: dict[str, Any],
    home_team: dict[str, Any],
    video_by_play: dict[str, dict[str, str]],
    video_list: list[dict[str, str]],
    game_links: dict[str, str],
    player_lookup: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Attach direct clip URL (if available) plus surgical short-clip (<4 min) YouTube & X video links."""
    play_id = str(moment.get("play_id") or "")
    description = str(moment.get("description") or "")
    qtr = int(moment.get("qtr") or 0)

    desc_info = _parse_play_search_descriptor(description, player_lookup)
    actors: list[str] = desc_info["primary_actors"]
    action_phrase: str = desc_info["action_phrase"]
    play_label: str = desc_info["play_label"]
    yardage: int | None = desc_info["yardage"]

    existing_url = str(moment.get("video_url") or "").strip()
    direct_url = existing_url if _is_direct_clip_url(existing_url) else ""
    video_title = str(moment.get("video_title") or "") if direct_url else ""
    direct_source = "ESPN Video Oficial"

    # 1. Match by play_id in summary/competition video catalog
    if not direct_url and play_id in video_by_play:
        cand_url = video_by_play[play_id].get("video_url", "")
        if _is_direct_clip_url(cand_url):
            direct_url = cand_url
            video_title = video_by_play[play_id].get("video_title", "")
            direct_source = video_by_play[play_id].get("video_source", "ESPN Video Oficial")

    # 2. Match against game video catalog (including embedded @NFL / Team clips in article.story)
    # Require matching the primary playmaker surname AND the action/context so a clip from another play isn't mismatched
    if not direct_url and video_list and actors:
        primary_surname = actors[0].split()[-1].lower()
        secondary_surname = actors[1].split()[-1].lower() if len(actors) > 1 else ""
        is_ot = qtr >= 5

        for vid in video_list:
            cand_url = vid.get("video_url", "")
            if not _is_direct_clip_url(cand_url):
                continue
            haystack = f"{vid.get('video_title', '')} {vid.get('video_description', '')}".lower()
            if len(primary_surname) < 3 or primary_surname not in haystack:
                continue
            # Verify action or yardage or secondary actor consistency
            action_ok = False
            if "interception" in action_phrase and ("intercept" in haystack or "pick" in haystack):
                # If a game has multiple INTs (e.g. Q4 vs OT), ensure overtime/regulation alignment
                if is_ot and ("overtime" in haystack or " ot " in haystack):
                    action_ok = True
                elif not is_ot and "overtime" not in haystack:
                    action_ok = True
            elif "field goal" in action_phrase and ("field goal" in haystack or (yardage and f"{yardage}-yard" in haystack)):
                action_ok = True
            elif "touchdown" in action_phrase and ("touchdown" in haystack or "td" in haystack or "scored" in haystack):
                if not yardage or f"{yardage}-yard" in haystack or f"{yardage} yard" in haystack or (secondary_surname and secondary_surname in haystack):
                    action_ok = True
            elif secondary_surname and secondary_surname in haystack:
                action_ok = True

            if action_ok:
                direct_url = cand_url
                video_title = vid.get("video_title", "")
                direct_source = vid.get("video_source", "Clip Oficial @NFL / ESPN")
                break

    away_nick = _team_nickname(away_team)
    home_nick = _team_nickname(home_team)
    qtr_label = "OT" if qtr >= 5 else (f"Q{qtr}" if qtr > 0 else "")

    # Build surgical single-play YouTube query:
    # - Uses full player names (primary playmaker first) + exact play action + team nicknames
    # - Avoids 'Team A vs Team B' + 'highlight' pattern which triggers 15-minute full-game recaps
    # - Uses YouTube's native sp=EgIYAQ%3D%3D parameter (Duration < 4 minutes: Short Clips Only)
    core_play_terms = " ".join(actors[:2] + [action_phrase, away_nick, home_nick]).strip()
    youtube_search_url = (
        f"https://www.youtube.com/results?search_query={quote_plus(core_play_terms)}&sp=EgIYAQ%3D%3D"
    )

    # Build X / @NFL single-play video search URL (f=video shows only short broadcast clips of the play)
    x_video_url = (
        direct_url
        if ("x.com/" in direct_url or "twitter.com/" in direct_url)
        else f"https://x.com/search?q={quote_plus(core_play_terms)}&f=video"
    )

    espn_play_url = game_links.get("pbp") or game_links.get("recap") or ""

    has_direct_video = bool(direct_url)
    primary_video_url = direct_url if has_direct_video else youtube_search_url
    video_source = direct_source if has_direct_video else "Clip Puntual (<4m)"

    return {
        **moment,
        "play_label": play_label,
        "video_query": core_play_terms,
        "video_query_v2": core_play_terms,
        "video_url": primary_video_url,
        "video_source": video_source,
        "video_title": video_title or f"Jugada Puntual: {play_label} ({away_team.get('abbreviation', '')} @ {home_team.get('abbreviation', '')} {qtr_label})".strip(),
        "has_direct_video": has_direct_video,
        "youtube_search_url": youtube_search_url,
        "x_video_url": x_video_url,
        "espn_play_url": espn_play_url,
    }


def _is_non_play_marker(moment: dict[str, Any]) -> bool:
    """Return True if a winprobability entry is an administrative boundary rather than an on-field snap."""
    desc = str(moment.get("description") or "").strip()
    qtr = int(moment.get("qtr") or 0)
    return _is_non_play_text(desc, qtr)


def _extract_all_wp_deltas(summary_data: dict[str, Any]) -> list[dict[str, Any]]:
    """Calculate win probability deltas across all plays in summary_data['winprobability']."""
    if not isinstance(summary_data, dict):
        return []

    wp_array = summary_data.get("winprobability")
    if not isinstance(wp_array, list) or not wp_array:
        return []

    play_lookup = _build_play_lookup(summary_data)
    video_by_play, _video_list = _extract_video_catalog(summary_data)
    game_links = _extract_game_links(summary_data)
    wp_play_ids = {
        str(item.get("playId") or item.get("play_id") or item.get("id") or "")
        for item in wp_array
        if isinstance(item, dict)
    }

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

        # If this WP row is attached to an administrative marker (like END GAME on a walk-off FG)
        # and the immediately preceding play in the drive was not in winprobability, attribute the
        # WP jump to that real preceding play!
        preceding_real = lookup_info.get("preceding_real_play")
        if isinstance(preceding_real, dict) and str(preceding_real.get("play_id") or "") not in wp_play_ids:
            lookup_info = preceding_real
            play_id = str(preceding_real.get("play_id") or play_id)

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

        play_video_url = str(
            lookup_info.get("video_url")
            or _extract_url_from_video_obj(nested_play.get("video") if isinstance(nested_play.get("video"), dict) else {})
            or _extract_url_from_video_obj(item.get("video") if isinstance(item.get("video"), dict) else {})
            or ""
        ).strip()

        base_moment: dict[str, Any] = {
            "play_id": play_id,
            "qtr": int(qtr),
            "clock": str(clock),
            "description": str(description),
            "home_wp_before": round(home_wp_before, 4),
            "home_wp_after": round(curr_home_wp, 4),
            "delta_wp": round(delta_wp, 4),
            "abs_delta_wp": round(abs_delta_wp, 4),
        }
        if play_video_url and _is_direct_clip_url(play_video_url):
            base_moment["video_url"] = play_video_url
        elif play_id in video_by_play:
            base_moment["video_url"] = video_by_play[play_id]["video_url"]

        if game_links.get("pbp"):
            base_moment["espn_play_url"] = game_links["pbp"]

        moments.append(base_moment)

    return moments


def extract_critical_moments(
    summary_data: dict[str, Any],
    min_delta: float = 0.12,
    top_n: int = 3,
    event_id: str = "",
    away_team: dict[str, Any] | None = None,
    home_team: dict[str, Any] | None = None,
    **kwargs: Any,
) -> list[dict[str, Any]]:
    """Extract top_n plays with |delta_wp| >= min_delta sorted descending by |delta_wp|."""
    all_moments = _extract_all_wp_deltas(summary_data)
    filtered = [m for m in all_moments if m["abs_delta_wp"] >= min_delta]
    real_plays = [m for m in filtered if not _is_non_play_marker(m)]
    candidates = real_plays if real_plays else filtered
    candidates.sort(key=lambda m: m["abs_delta_wp"], reverse=True)
    top_moments = candidates[:top_n]

    video_by_play, video_list = _extract_video_catalog(summary_data)
    player_lookup = _build_player_name_lookup(summary_data)
    resolved_event_id = str(event_id or summary_data.get("header", {}).get("id") or "nfl")
    game_links = _extract_game_links(summary_data, event_id=resolved_event_id)
    away_dict = away_team or {"abbreviation": str(kwargs.get("away_abbr", "AWAY")), "name": str(kwargs.get("away_abbr", "NFL"))}
    home_dict = home_team or {"abbreviation": str(kwargs.get("home_abbr", "HOME")), "name": str(kwargs.get("home_abbr", "NFL"))}

    return [
        _enrich_moment_with_video_links(
            m,
            event_id=resolved_event_id,
            away_team=away_dict,
            home_team=home_dict,
            video_by_play=video_by_play,
            video_list=video_list,
            game_links=game_links,
            player_lookup=player_lookup,
        )
        for m in top_moments
    ]


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


def _load_completed_game_cache(target_path: Path) -> dict[str, dict[str, Any]]:
    """Load already-completed games from existing live_scoreboard.json if they have v2 play-specific video metadata."""
    cache: dict[str, dict[str, Any]] = {}
    if not target_path.exists():
        return cache
    try:
        existing = json.loads(target_path.read_text(encoding="utf-8"))
        for g in existing.get("games", []):
            if not isinstance(g, dict):
                continue
            eid = str(g.get("event_id") or "")
            st = g.get("status") if isinstance(g.get("status"), dict) else {}
            hp = g.get("hinge_play") if isinstance(g.get("hinge_play"), dict) else None
            if (
                eid
                and st.get("completed") is True
                and hp is not None
                and bool(hp.get("video_query_v2"))
                and str(hp.get("video_url") or "").startswith("http")
                and not _is_non_play_text(str(hp.get("description") or ""))
            ):
                cache[eid] = g
    except Exception:  # noqa: BLE001
        pass
    return cache


def ingest_espn_scoreboard(
    output_path: Path | str | None = None,
    include_all_regular_weeks: bool = True,
) -> dict[str, Any]:
    """Fetch ESPN scoreboard + game summaries for the Regular Season (excluding Preseason) and persist JSON."""
    target_path = Path(output_path) if output_path is not None else DEFAULT_OUTPUT_PATH
    cached_completed = _load_completed_game_cache(target_path)

    scoreboard_raw = fetch_scoreboard()
    season_obj = scoreboard_raw.get("season") if isinstance(scoreboard_raw.get("season"), dict) else {}
    week_obj = scoreboard_raw.get("week") if isinstance(scoreboard_raw.get("week"), dict) else {}

    season = int(season_obj.get("year") or 2026)
    season_type_num = int(season_obj.get("type") or 2)
    week = int(week_obj.get("number") or 1)

    # Si ESPN responde en pretemporada (seasontype == 1), forzar Temporada Regular (seasontype == 2)
    if season_type_num == 1:
        season_type_num = 2
        try:
            scoreboard_raw = fetch_scoreboard(week=1, seasontype=2)
            season_obj = scoreboard_raw.get("season") if isinstance(scoreboard_raw.get("season"), dict) else {}
            week_obj = scoreboard_raw.get("week") if isinstance(scoreboard_raw.get("week"), dict) else {}
            season = int(season_obj.get("year") or season)
            week = int(week_obj.get("number") or 1)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not switch from Preseason to Regular Season scoreboard: %s", exc)

    raw_events_by_week: list[tuple[int, str, dict[str, Any]]] = []
    seen_event_ids: set[str] = set()

    def _add_events(ev_list: Any, default_week: int, default_stype: str = "REG") -> None:
        if not isinstance(ev_list, list):
            return
        for ev in ev_list:
            if not isinstance(ev, dict):
                continue
            ev_season = ev.get("season") if isinstance(ev.get("season"), dict) else {}
            ev_stype_num = int(ev_season.get("type") or 2)
            # Excluir estrictamente partidos de Pretemporada (type == 1)
            if ev_stype_num == 1:
                continue
            ev_stype_label = "POST" if ev_stype_num == 3 else default_stype
            ev_week_obj = ev.get("week") if isinstance(ev.get("week"), dict) else {}
            ev_week = int(ev_week_obj.get("number") or default_week)
            eid = str(ev.get("id") or "")
            if eid and eid in seen_event_ids:
                continue
            if eid:
                seen_event_ids.add(eid)
            raw_events_by_week.append((ev_week, ev_stype_label, ev))

    # Si include_all_regular_weeks está activo, recolectar todas las semanas de Temporada Regular (1..week)
    if include_all_regular_weeks and week > 1:
        prior_weeks = list(range(1, week))

        def _fetch_week_sb(w: int) -> tuple[int, list[dict[str, Any]]]:
            try:
                sb_w = fetch_scoreboard(week=w, seasontype=2)
                evs = sb_w.get("events")
                return w, evs if isinstance(evs, list) else []
            except Exception as exc:  # noqa: BLE001
                logger.warning("Could not fetch Regular Season Week %d scoreboard: %s", w, exc)
                return w, []

        with ThreadPoolExecutor(max_workers=min(len(prior_weeks), 6)) as pool:
            week_results = list(pool.map(_fetch_week_sb, prior_weeks))

        # Agregar de la semana más reciente a la Semana 1, poniendo primero las semanas jugadas
        for w, evs in sorted(week_results, key=lambda x: x[0], reverse=True):
            _add_events(evs, default_week=w, default_stype="REG")

    # Agregar también la semana actual
    current_events = scoreboard_raw.get("events")
    _add_events(
        current_events,
        default_week=week,
        default_stype="POST" if season_type_num == 3 else "REG",
    )

    # Identificar qué event_ids requieren consulta a /summary (los no cacheados o aún en juego)
    events_needing_summary: list[str] = []
    for _ev_w, _ev_st, event in raw_events_by_week:
        eid = str(event.get("id") or "")
        if not eid:
            continue
        status_raw = event.get("status") if isinstance(event.get("status"), dict) else {}
        status_type = status_raw.get("type") if isinstance(status_raw.get("type"), dict) else {}
        is_completed = bool(status_type.get("completed", False))
        if not (is_completed and eid in cached_completed):
            events_needing_summary.append(eid)

    summaries_by_id: dict[str, dict[str, Any]] = {}
    if events_needing_summary:
        def _safe_fetch_summary(eid: str) -> tuple[str, dict[str, Any]]:
            try:
                return eid, fetch_game_summary(eid)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Could not fetch summary for event %s: %s", eid, exc)
                return eid, {}

        max_workers = min(len(events_needing_summary), 10)
        if max_workers <= 1:
            for eid in events_needing_summary:
                _, s_data = _safe_fetch_summary(eid)
                summaries_by_id[eid] = s_data
        else:
            with ThreadPoolExecutor(max_workers=max_workers) as pool:
                for eid, s_data in pool.map(_safe_fetch_summary, events_needing_summary):
                    summaries_by_id[eid] = s_data

    games: list[dict[str, Any]] = []

    for ev_week, ev_stype_label, event in raw_events_by_week:
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

        # Reutilizar partido finalizado desde caché si ya cuenta con Jugada Bisagra y enlaces de video
        if completed and event_id in cached_completed:
            cached_game = dict(cached_completed[event_id])
            cached_game["week"] = int(ev_week)
            cached_game["season_type"] = ev_stype_label
            games.append(cached_game)
            continue

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

        summary_data = summaries_by_id.get(event_id, {})

        video_by_play, video_list = _extract_video_catalog(summary_data, comp)
        player_lookup = _build_player_name_lookup(summary_data)
        game_links = _extract_game_links(summary_data, event, event_id)

        raw_critical = extract_critical_moments(
            summary_data,
            min_delta=0.12,
            top_n=3,
            event_id=event_id,
            away_team=away_team,
            home_team=home_team,
        )
        critical_moments = [
            _enrich_moment_with_video_links(
                m,
                event_id,
                away_team,
                home_team,
                video_by_play,
                video_list,
                game_links,
                player_lookup=player_lookup,
            )
            for m in raw_critical
        ]
        all_moments = _extract_all_wp_deltas(summary_data)
        real_all_moments = [m for m in all_moments if not _is_non_play_marker(m)]
        fallback_pool = real_all_moments if real_all_moments else all_moments

        if critical_moments:
            hinge_play: dict[str, Any] | None = {
                **critical_moments[0],
                "exceeds_threshold": True,
            }
        elif fallback_pool:
            best_moment = max(fallback_pool, key=lambda m: m["abs_delta_wp"])
            enriched_best = _enrich_moment_with_video_links(
                best_moment,
                event_id,
                away_team,
                home_team,
                video_by_play,
                video_list,
                game_links,
                player_lookup=player_lookup,
            )
            hinge_play = {
                **enriched_best,
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
                "week": int(ev_week),
                "season_type": ev_stype_label,
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
                "game_links": game_links,
                "critical_moments": critical_moments,
                "hinge_play": hinge_play,
            }
        )

    # Ordenar partidos: primero en vivo ('in'), luego finalizados ('post') de la semana más reciente a la 1, luego programados ('pre')
    state_priority = {"in": 0, "post": 1, "pre": 2}
    games.sort(
        key=lambda g: (
            state_priority.get(str(g.get("status", {}).get("state", "pre")), 3),
            -int(g.get("week") or 0),
        )
    )

    weeks_available = sorted({int(g.get("week") or week) for g in games})
    completed_count = sum(1 for g in games if g.get("status", {}).get("completed") is True)
    hinge_count = sum(1 for g in games if (g.get("hinge_play") or {}).get("exceeds_threshold") is True)

    payload: dict[str, Any] = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": "ESPN JSON API",
        "season": season,
        "season_type": "REG",
        "preseason_excluded": True,
        "week": week,
        "weeks_available": weeks_available,
        "total_games": len(games),
        "completed_games": completed_count,
        "hinge_games_count": hinge_count,
        "games": games,
    }

    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    logger.info(
        "Saved ESPN scoreboard with %d Regular Season games (weeks=%s, completed=%d) to %s",
        len(games),
        weeks_available,
        completed_count,
        target_path,
    )
    return payload


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    ingest_espn_scoreboard()
