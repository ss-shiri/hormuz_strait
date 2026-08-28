```python
#!/usr/bin/env python3
"""
Hormuz OSINT Monitor — RSS/Atom Collector

Production-oriented collector for GitHub Actions.

Responsibilities
----------------
1. Load source, keyword, and reliability configuration.
2. Fetch RSS/Atom feeds safely.
3. Parse and normalize publication timestamps.
4. Filter stale items.
5. Deduplicate by stable item ID.
6. Merge newly collected items with the existing feed.
7. Prune the feed to MAX_ITEMS.
8. Generate deterministic, analyst-friendly metadata.
9. Write docs/data/feed.json atomically.

Important
---------
This collector performs COLLECTION, not VERIFICATION.

"confidence" / "reliability_letter" describe the originating source,
not the truth status of an individual claim.

The resulting feed MUST NOT be interpreted as verified intelligence.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import tempfile
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import feedparser
import requests
import yaml
from dateutil import parser as dateparser


# ============================================================================
# PATHS
# ============================================================================

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))

FEED_PATH = os.path.join(ROOT, "docs", "data", "feed.json")

SOURCES_PATH = os.path.join(HERE, "sources.yaml")
KEYWORDS_PATH = os.path.join(HERE, "keywords.yaml")
RELIABILITY_PATH = os.path.join(HERE, "reliability.yaml")


# ============================================================================
# COLLECTION CONFIGURATION
# ============================================================================

MAX_ITEMS = 200
MAX_AGE_DAYS = 14

REQUEST_TIMEOUT = (5, 15)
MAX_REDIRECTS = 5

# Avoid hammering RSS servers.
REQUEST_DELAY_SECONDS = 0.25

USER_AGENT = (
    "Hormuz-OSINT-Monitor/1.0 "
    "(+https://ss-shiri.github.io/hormuz_strait)"
)

# HTTP status codes which should be treated as temporary failures.
RETRY_STATUS_CODES = {
    408,
    425,
    429,
    500,
    502,
    503,
    504,
}


# ============================================================================
# LOGGING
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)

logger = logging.getLogger("hormuz-collector")


# ============================================================================
# TIME HELPERS
# ============================================================================

def utc_now() -> datetime:
    """Return current UTC time as a timezone-aware datetime."""
    return datetime.now(timezone.utc)


def parse_date(value: Any) -> datetime | None:
    """
    Parse an arbitrary feed timestamp and normalize it to UTC.

    Handles:
    - RFC 822
    - ISO 8601
    - timezone-aware timestamps
    - timezone-naive timestamps

    Naive timestamps are assumed to be UTC.
    """
    if not value:
        return None

    try:
        dt = dateparser.parse(str(value))
    except (ValueError, TypeError, OverflowError):
        return None

    if dt is None:
        return None

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(timezone.utc)


def iso_utc(dt: datetime) -> str:
    """Return normalized ISO-8601 UTC timestamp."""
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


# ============================================================================
# FILE HELPERS
# ============================================================================

def load_yaml(path: str) -> Any:
    """Load a UTF-8 YAML file safely."""
    if not os.path.exists(path):
        raise FileNotFoundError(path)

    with open(path, "r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def load_json(path: str) -> dict[str, Any]:
    """Load existing feed.json, falling back safely if unavailable."""
    if not os.path.exists(path):
        return {"meta": {}, "items": []}

    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)

        if not isinstance(data, dict):
            raise ValueError("feed.json root is not an object")

        if not isinstance(data.get("items"), list):
            data["items"] = []

        return data

    except (OSError, json.JSONDecodeError, ValueError) as exc:
        logger.warning(
            "Existing feed.json is invalid; starting fresh: %s",
            exc,
        )
        return {"meta": {}, "items": []}


def atomic_write_json(path: str, data: dict[str, Any]) -> None:
    """
    Atomically replace feed.json.

    This prevents a partially-written JSON file if the process is interrupted.
    """
    directory = os.path.dirname(path)
    os.makedirs(directory, exist_ok=True)

    fd, temp_path = tempfile.mkstemp(
        prefix=".feed-",
        suffix=".json",
        dir=directory,
        text=True,
    )

    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(
                data,
                handle,
                ensure_ascii=False,
                indent=2,
                sort_keys=False,
            )
            handle.write("\n")

        os.replace(temp_path, path)

    except Exception:
        try:
            os.unlink(temp_path)
        except OSError:
            pass
        raise


# ============================================================================
# TEXT / URL NORMALIZATION
# ============================================================================

def clean_text(value: Any) -> str:
    """Normalize whitespace while preserving Unicode."""
    if value is None:
        return ""

    return " ".join(str(value).split())


def normalize_url(url: Any) -> str:
    """
    Normalize URLs for more reliable deduplication.

    Removes:
    - fragments
    - surrounding whitespace

    Keeps query parameters because they can be semantically meaningful.
    """
    if not url:
        return ""

    url = str(url).strip()

    try:
        parts = urlsplit(url)

        if not parts.scheme or not parts.netloc:
            return url

        return urlunsplit(
            (
                parts.scheme.lower(),
                parts.netloc.lower(),
                parts.path,
                parts.query,
                "",
            )
        )

    except ValueError:
        return url


def domain_of(url: str) -> str:
    """Extract hostname without credentials or port."""
    try:
        return urlsplit(url).hostname or ""
    except ValueError:
        return ""


def item_id(
    url: str,
    title: str = "",
    published: str = "",
) -> str:
    """
    Generate a stable 16-character SHA-256 item identifier.

    URL is the primary identity.
    Title/date provide a fallback for malformed or repeated feed URLs.
    """
    normalized = normalize_url(url)

    identity = normalized or "|".join(
        (
            clean_text(title).lower(),
            clean_text(published),
        )
    )

    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()
    return digest[:16]


# ============================================================================
# HTTP
# ============================================================================

def create_session() -> requests.Session:
    """Create a reusable HTTP session."""
    session = requests.Session()

    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": (
                "application/rss+xml, "
                "application/atom+xml, "
                "application/xml, "
                "text/xml, "
                "text/html;q=0.9, "
                "*/*;q=0.8"
            ),
        }
    )

    return session


def fetch(
    session: requests.Session,
    url: str,
) -> str | None:
    """
    Fetch a feed with bounded retries.

    Returns response text on success, otherwise None.
    """
    for attempt in range(1, 4):
        try:
            response = session.get(
                url,
                timeout=REQUEST_TIMEOUT,
                allow_redirects=True,
            )

            if response.status_code in RETRY_STATUS_CODES:
                if attempt < 3:
                    delay = attempt * 2
                    logger.warning(
                        "Temporary HTTP %s for %s; retrying in %ss",
                        response.status_code,
                        url,
                        delay,
                    )
                    time_sleep(delay)
                    continue

            response.raise_for_status()

            if not response.text.strip():
                raise ValueError("empty response")

            return response.text

        except requests.RequestException as exc:
            if attempt < 3:
                delay = attempt * 2
                logger.warning(
                    "Fetch attempt %s failed for %s: %s; retrying in %ss",
                    attempt,
                    url,
                    exc,
                    delay,
                )
                time_sleep(delay)
                continue

            logger.warning(
                "Fetch failed after retries: %s (%s)",
                url,
                exc,
            )

        except ValueError as exc:
            logger.warning(
                "Invalid response from %s: %s",
                url,
                exc,
            )
            break

    return None


def time_sleep(seconds: float) -> None:
    """Small wrapper to make sleep easy to test/replace."""
    import time

    time.sleep(seconds)


# ============================================================================
# FEED EXTRACTION
# ============================================================================

def extract_published(entry: Any) -> datetime | None:
    """
    Extract publication time using the feed's structured time first,
    then textual date fields as fallback.
    """

    # feedparser's structured timestamp.
    for field in (
        "published_parsed",
        "updated_parsed",
        "created_parsed",
    ):
        parsed = entry.get(field)

        if parsed:
            try:
                dt = datetime(
                    parsed.tm_year,
                    parsed.tm_mon,
                    parsed.tm_mday,
                    parsed.tm_hour,
                    parsed.tm_min,
                    parsed.tm_sec,
                    tzinfo=timezone.utc,
                )
                return dt
            except (AttributeError, TypeError, ValueError):
                pass

    # Textual fallback.
    for field in (
        "published",
        "updated",
        "created",
        "date",
    ):
        dt = parse_date(entry.get(field))
        if dt:
            return dt

    return None


def extract_summary(entry: Any) -> str:
    """Extract the best available summary/description."""
    for field in (
        "summary",
        "description",
        "subtitle",
    ):
        value = clean_text(entry.get(field))
        if value:
            return value

    return ""


def extract_link(entry: Any) -> str:
    """Extract and normalize the preferred article URL."""
    link = entry.get("link")

    if link:
        return normalize_url(link)

    # Atom feeds can expose alternate links.
    for candidate in entry.get("links", []):
        if candidate.get("rel") == "alternate" and candidate.get("href"):
            return normalize_url(candidate["href"])

    return ""


# ============================================================================
# KEYWORD MATCHING
# ============================================================================

def build_keyword_list(
    entry: Any,
    keywords_config: Any,
) -> list[str]:
    """
    Determine relevant configured keywords.

    Supports either:

        default:
          - hormuz
          - strait

    or:

        default:
          - hormuz
        english:
          - tanker
          - iran
        dutch:
          - hormuz

    Matching is case-insensitive against title + summary.

    If no configured keyword matches, returns the configured default list.
    """

    if not isinstance(keywords_config, dict):
        return []

    title = clean_text(entry.get("title")).lower()
    summary = extract_summary(entry).lower()
    haystack = f"{title} {summary}"

    matched: list[str] = []

    for category, values in keywords_config.items():

        if not isinstance(values, list):
            continue

        for keyword in values:
            keyword_clean = clean_text(keyword)

            if not keyword_clean:
                continue

            if keyword_clean.lower() in haystack:
                if keyword_clean not in matched:
                    matched.append(keyword_clean)

    if matched:
        return matched

    defaults = keywords_config.get("default", [])

    if isinstance(defaults, list):
        return [
            clean_text(keyword)
            for keyword in defaults
            if clean_text(keyword)
        ]

    return []


# ============================================================================
# RELIABILITY
# ============================================================================

def get_reliability(
    source_name: str,
    reliability_config: Any,
) -> tuple[str, str]:
    """
    Resolve source reliability.

    Preferred format:

        source_name:
          confidence: high
          letter: A

    Also supports the legacy format:

        source_name: high

    Returns:
        confidence, reliability_letter
    """

    record = reliability_config.get(source_name)

    if record is None:
        return "low", "F"

    if isinstance(record, dict):
        confidence = clean_text(
            record.get("confidence", "low")
        ).lower()

        letter = clean_text(
            record.get("letter", "F")
        ).upper()

        return confidence or "low", letter or "F"

    if isinstance(record, str):
        value = record.strip()

        # Legacy confidence-only configuration.
        if value.lower() in {"high", "medium", "low"}:
            return value.lower(), "F"

        # Legacy reliability letter.
        if len(value) == 1 and value.upper() in "ABCDEF":
            letter = value.upper()

            confidence_map = {
                "A": "high",
                "B": "high",
                "C": "medium",
                "D": "medium",
                "E": "low",
                "F": "low",
            }

            return confidence_map[letter], letter

    return "low", "F"


# ============================================================================
# COLLECTION
# ============================================================================

def collect() -> tuple[list[dict[str, Any]], list[str], list[str]]:
    """
    Collect all configured feeds.

    Returns:
        new_items
        successful source names
        failed source names
    """

    sources = load_yaml(SOURCES_PATH)
    keywords = load_yaml(KEYWORDS_PATH)
    reliability = load_yaml(RELIABILITY_PATH)

    if not isinstance(sources, list):
        raise ValueError("sources.yaml must contain a YAML list")

    session = create_session()

    cutoff = utc_now() - timedelta(days=MAX_AGE_DAYS)

    items: list[dict[str, Any]] = []
    sources_ok: list[str] = []
    sources_failed: list[str] = []

    for index, source in enumerate(sources, start=1):

        if not isinstance(source, dict):
            logger.warning(
                "Skipping malformed source #%s",
                index,
            )
            continue

        name = clean_text(source.get("name"))
        url = normalize_url(source.get("url"))

        if not name or not url:
            logger.warning(
                "Skipping source #%s: missing name or URL",
                index,
            )
            sources_failed.append(name or f"source_{index}")
            continue

        logger.info(
            "[%s/%s] Fetching: %s → %s",
            index,
            len(sources),
            name,
            url,
        )

        xml = fetch(session, url)

        if not xml:
            sources_failed.append(name)
            continue

        parsed = feedparser.parse(xml)

        if getattr(parsed, "bozo", False):
            logger.warning(
                "Feed parser warning for %s: %s",
                name,
                getattr(parsed, "bozo_exception", "unknown"),
            )

        if not parsed.entries:
            logger.warning(
                "No entries found: %s",
                name,
            )
            sources_failed.append(name)
            continue

        sources_ok.append(name)

        confidence, reliability_letter = get_reliability(
            name,
            reliability,
        )

        for entry in parsed.entries:

            title = clean_text(entry.get("title"))

            if not title:
                continue

            link = extract_link(entry)

            if not link:
                continue

            published_dt = extract_published(entry)

            if published_dt is None:
                continue

            if published_dt < cutoff:
                continue

            summary = extract_summary(entry)

            item = {
                "id": item_id(
                    link,
                    title,
                    iso_utc(published_dt),
                ),
                "title": title,
                "summary": summary,
                "link": link,
                "lang": clean_text(
                    source.get("lang") or "en"
                ),
                "source": name,
                "domain": domain_of(link),
                "feed": name,
                "category": clean_text(
                    source.get("category") or "news"
                ),
                "confidence": confidence,
                "reliability_letter": reliability_letter,
                "published": iso_utc(published_dt),
                "published_ts": int(
                    published_dt.timestamp()
                ),
                "keywords": build_keyword_list(
                    entry,
                    keywords,
                ),
            }

            items.append(item)

        time_sleep(REQUEST_DELAY_SECONDS)

    return items, sources_ok, sources_failed


# ============================================================================
# MERGE / DEDUPLICATION / PRUNING
# ============================================================================

def merge_and_prune(
    existing_items: list[dict[str, Any]],
    new_items: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int]:
    """
    Merge existing and new items.

    New records replace existing records with the same ID.

    Returns:
        merged items
        number of genuinely new IDs
    """

    existing_by_id: dict[str, dict[str, Any]] = {}

    for item in existing_items:

        if not isinstance(item, dict):
            continue

        item_id_value = clean_text(item.get("id"))

        if not item_id_value:
            continue

        existing_by_id[item_id_value] = item

    existing_ids = set(existing_by_id)

    for item in new_items:
        item_id_value = item.get("id")

        if not item_id_value:
            continue

        existing_by_id[item_id_value] = item

    merged = list(existing_by_id.values())

    # Ensure deterministic ordering.
    merged.sort(
        key=lambda item: int(
            item.get("published_ts", 0) or 0
        ),
        reverse=True,
    )

    merged = merged[:MAX_ITEMS]

    new_count = sum(
        1
        for item in new_items
        if item.get("id") not in existing_ids
    )

    return merged, new_count


# ============================================================================
# METADATA
# ============================================================================

def build_meta(
    merged: list[dict[str, Any]],
    new_count: int,
    sources_ok: list[str],
    sources_failed: list[str],
) -> dict[str, Any]:
    """Generate feed metadata."""

    by_confidence: dict[str, int] = {
        "high": 0,
        "medium": 0,
        "low": 0,
    }

    by_language: dict[str, int] = {}

    for item in merged:

        confidence = clean_text(
            item.get("confidence") or "low"
        ).lower()

        if confidence in by_confidence:
            by_confidence[confidence] += 1
        else:
            by_confidence["low"] += 1

        language = clean_text(
            item.get("lang") or "unknown"
        ).lower()

        by_language[language] = (
            by_language.get(language, 0) + 1
        )

    return {
        "generated_at": iso_utc(utc_now()),
        "collector": "hormuz-osint-collector",
        "collector_version": "1.0",
        "count": len(merged),
        "new_this_run": new_count,
        "collected_this_run": len(
            merged
        ),
        "by_confidence": by_confidence,
        "by_language": dict(
            sorted(by_language.items())
        ),
        "sources_ok": sources_ok,
        "sources_failed": sources_failed,
        "source_count": len(
            sources_ok
        ) + len(sources_failed),
        "verified": False,
        "seed": False,
        "collection_only": True,
        "max_age_days": MAX_AGE_DAYS,
        "max_items": MAX_ITEMS,
    }


# ============================================================================
# VALIDATION
# ============================================================================

def validate_feed(feed: dict[str, Any]) -> None:
    """
    Basic structural validation before writing feed.json.

    Raises ValueError if the feed is malformed.
    """

    if not isinstance(feed, dict):
        raise ValueError("Feed must be an object")

    if not isinstance(feed.get("meta"), dict):
        raise ValueError("Feed meta must be an object")

    if not isinstance(feed.get("items"), list):
        raise ValueError("Feed items must be a list")

    for index, item in enumerate(feed["items"]):

        if not isinstance(item, dict):
            raise ValueError(
                f"Item {index} is not an object"
            )

        required = (
            "id",
            "title",
            "link",
            "source",
            "published",
            "published_ts",
        )

        missing = [
            key
            for key in required
            if key not in item
        ]

        if missing:
            raise ValueError(
                f"Item {index} missing: {missing}"
            )


# ============================================================================
# MAIN
# ============================================================================

def main() -> int:
    """Collector entry point."""

    logger.info(
        "Starting Hormuz OSINT Collector"
    )

    try:
        new_items, sources_ok, sources_failed = collect()

        existing = load_json(FEED_PATH)

        existing_items = existing.get(
            "items",
            [],
        )

        merged, new_count = merge_and_prune(
            existing_items,
            new_items,
        )

        feed = {
            "meta": build_meta(
                merged=merged,
                new_count=new_count,
                sources_ok=sources_ok,
                sources_failed=sources_failed,
            ),
            "items": merged,
        }

        validate_feed(feed)

        atomic_write_json(
            FEED_PATH,
            feed,
        )

        logger.info(
            "Collection complete | collected=%s | new=%s | total=%s | ok=%s | failed=%s",
            len(new_items),
            new_count,
            len(merged),
            len(sources_ok),
            len(sources_failed),
        )

        logger.info(
            "Wrote feed.json → %s",
            FEED_PATH,
        )

        # Do not fail GitHub Actions merely because one RSS source failed.
        # Fail only on a complete collector/runtime error.
        return 0

    except Exception:
        logger.exception(
            "Fatal collector error"
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
```
