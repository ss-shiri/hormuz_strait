#!/usr/bin/env python3
"""
Hormuz OSINT Monitor - collector / crawler
==========================================

Aggregates everything related to the Strait of Hormuz from multilingual
RSS and Google-News-search feeds (Persian, Arabic, English), tags each item
with a SOURCE-based confidence level, de-duplicates, and writes a single
JSON file the static site reads.

DESIGN PRINCIPLE: this tool COLLECTS, it does not VERIFY. No claim is
fact-checked. The confidence tag reflects only the historical standing of
the originating outlet (see reliability.yaml).

Usage:
    python collector/collect.py            # normal run
    python collector/collect.py --dry-run  # collect but do not write feed.json

Exit code is 0 even if some feeds fail; partial collection is expected.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import os
import re
import sys
import time
from urllib.parse import quote_plus, urlparse

try:
    import feedparser
    import yaml
    from dateutil import parser as dateparser
except ImportError as exc:  # pragma: no cover
    sys.stderr.write(
        "Missing dependency: %s\nRun: pip install -r requirements.txt\n" % exc
    )
    raise

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FEED_PATH = os.path.join(ROOT, "docs", "data", "feed.json")

MAX_ITEMS = 800          # hard cap kept in feed.json
MAX_AGE_DAYS = 30        # drop anything older than this
REQUEST_TIMEOUT = 25     # seconds per feed
USER_AGENT = (
    "HormuzOSINTMonitor/1.0 (+https://github.com/) "
    "OSINT collection bot; contact: @CBRNE_OSINT"
)

TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")


# --------------------------------------------------------------------------- #
#  Config loading                                                             #
# --------------------------------------------------------------------------- #
def load_yaml(name: str):
    with open(os.path.join(HERE, name), "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def build_gnews_url(src: dict) -> str:
    """Turn a `kind: gnews` source into a Google News RSS search URL."""
    q = quote_plus(src["query"])
    hl = src.get("hl", "en-US")
    gl = src.get("gl", "US")
    ceid = src.get("ceid", "US:en")
    return (
        "https://news.google.com/rss/search?"
        f"q={q}&hl={hl}&gl={gl}&ceid={ceid}"
    )


# --------------------------------------------------------------------------- #
#  Reliability scoring                                                         #
# --------------------------------------------------------------------------- #
class Reliability:
    def __init__(self, cfg: dict):
        self.default = cfg.get("default", {"tier": "low", "letter": "F"})
        self.rules = cfg.get("rules", [])

    def score(self, domain: str, name: str) -> tuple[str, str]:
        hay = f"{domain} {name}".lower()
        for rule in self.rules:
            for token in rule.get("match", []):
                if token.lower() in hay:
                    return rule.get("tier", "low"), rule.get("letter", "F")
        return self.default["tier"], self.default["letter"]


# --------------------------------------------------------------------------- #
#  Helpers                                                                     #
# --------------------------------------------------------------------------- #
def clean_text(raw: str, limit: int = 300) -> str:
    if not raw:
        return ""
    text = html.unescape(TAG_RE.sub(" ", raw))
    text = WS_RE.sub(" ", text).strip()
    if len(text) > limit:
        text = text[: limit - 1].rstrip() + "\u2026"
    return text


def domain_of(url: str) -> str:
    try:
        host = urlparse(url).netloc.lower()
        return host[4:] if host.startswith("www.") else host
    except Exception:
        return ""


def parse_date(entry) -> dt.datetime:
    for key in ("published", "updated", "created"):
        val = entry.get(key)
        if val:
            try:
                d = dateparser.parse(val)
                if d.tzinfo is None:
                    d = d.replace(tzinfo=dt.timezone.utc)
                return d.astimezone(dt.timezone.utc)
            except Exception:
                pass
    return dt.datetime.now(dt.timezone.utc)


def publisher_of(entry, feed_name: str, link: str) -> tuple[str, str]:
    """Return (publisher_name, publisher_domain).

    Google News wraps many outlets; the real publisher sits in entry.source.
    """
    src = entry.get("source")
    if isinstance(src, dict) and src.get("title"):
        name = src["title"]
        dom = domain_of(src.get("href", "")) or domain_of(link)
        return name, dom
    dom = domain_of(link)
    return feed_name, dom


def match_keywords(text: str, terms: list[str]) -> list[str]:
    low = text.lower()
    hits = []
    for term in terms:
        if term.lower() in low:
            hits.append(term)
    return hits


def item_id(link: str, title: str) -> str:
    base = (link or "") + "|" + (title or "")
    return hashlib.sha1(base.encode("utf-8", "ignore")).hexdigest()[:16]


# --------------------------------------------------------------------------- #
#  Core collection                                                            #
# --------------------------------------------------------------------------- #
def fetch(url: str):
    return feedparser.parse(
        url,
        agent=USER_AGENT,
        request_headers={"Cache-Control": "no-cache"},
    )


def collect(sources, keywords, reliability) -> tuple[list, dict]:
    core = keywords.get("core", [])
    context = keywords.get("context", [])
    items: dict[str, dict] = {}
    ok, failed = [], []

    for src in sources:
        name = src.get("name", "source")
        lang = src.get("lang", "en")
        category = src.get("category", "news")
        url = build_gnews_url(src) if src.get("kind") == "gnews" else src.get("url")
        if not url:
            failed.append({"name": name, "error": "no url"})
            continue

        try:
            parsed = fetch(url)
        except Exception as exc:  # pragma: no cover
            failed.append({"name": name, "error": str(exc)[:120]})
            continue

        entries = parsed.get("entries", []) or []
        if not entries and parsed.get("bozo"):
            failed.append({"name": name, "error": "unreachable / parse error"})
            continue

        kept = 0
        for e in entries:
            title = clean_text(e.get("title", ""), 240)
            summary = clean_text(e.get("summary", e.get("description", "")), 300)
            link = e.get("link", "")
            blob = f"{title} {summary}"

            core_hits = match_keywords(blob, core)
            if not core_hits:
                continue  # unrelated to Hormuz -> skip

            pub_name, pub_dom = publisher_of(e, name, link)
            tier, letter = reliability.score(pub_dom, pub_name)
            published = parse_date(e)

            rec = {
                "id": item_id(link, title),
                "title": title,
                "summary": summary,
                "link": link,
                "lang": lang,
                "source": pub_name,
                "domain": pub_dom,
                "feed": name,
                "category": category,
                "confidence": tier,
                "reliability_letter": letter,
                "published": published.isoformat(),
                "published_ts": int(published.timestamp()),
                "keywords": core_hits + match_keywords(blob, context),
            }
            # de-dup: keep the earliest-seen / most complete record
            items.setdefault(rec["id"], rec)
            kept += 1

        ok.append({"name": name, "entries": len(entries), "kept": kept})
        time.sleep(0.4)  # be polite

    stats = {"ok": ok, "failed": failed}
    return list(items.values()), stats


# --------------------------------------------------------------------------- #
#  Merge with existing feed + prune                                           #
# --------------------------------------------------------------------------- #
def load_existing() -> list:
    if not os.path.exists(FEED_PATH):
        return []
    try:
        with open(FEED_PATH, "r", encoding="utf-8") as fh:
            return json.load(fh).get("items", [])
    except Exception:
        return []


def merge_and_prune(new_items: list, old_items: list) -> list:
    by_id = {it["id"]: it for it in old_items if "id" in it}
    for it in new_items:
        by_id[it["id"]] = it  # newest wins on conflict

    cutoff = int(
        (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=MAX_AGE_DAYS)).timestamp()
    )
    merged = [
        it for it in by_id.values()
        if int(it.get("published_ts", 0)) >= cutoff
    ]
    merged.sort(key=lambda it: it.get("published_ts", 0), reverse=True)
    return merged[:MAX_ITEMS]


# --------------------------------------------------------------------------- #
#  Main                                                                        #
# --------------------------------------------------------------------------- #
def main() -> int:
    ap = argparse.ArgumentParser(description="Hormuz OSINT collector")
    ap.add_argument("--dry-run", action="store_true", help="do not write feed.json")
    args = ap.parse_args()

    sources = load_yaml("sources.yaml")
    keywords = load_yaml("keywords.yaml")
    reliability = Reliability(load_yaml("reliability.yaml"))

    new_items, stats = collect(sources, keywords, reliability)
    merged = merge_and_prune(new_items, load_existing())

    by_conf = {"high": 0, "medium": 0, "low": 0}
    by_lang = {"fa": 0, "ar": 0, "en": 0}
    for it in merged:
        by_conf[it.get("confidence", "low")] = by_conf.get(it.get("confidence", "low"), 0) + 1
        by_lang[it.get("lang", "en")] = by_lang.get(it.get("lang", "en"), 0) + 1

    payload = {
        "meta": {
            "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "count": len(merged),
            "new_this_run": len(new_items),
            "by_confidence": by_conf,
            "by_language": by_lang,
            "sources_ok": stats["ok"],
            "sources_failed": stats["failed"],
            "verified": False,
            "note": "Automated, UNVERIFIED OSINT aggregation. Confidence = source standing only.",
        },
        "items": merged,
    }

    print(
        "collected new=%d  merged=%d  ok_feeds=%d  failed_feeds=%d"
        % (len(new_items), len(merged), len(stats["ok"]), len(stats["failed"]))
    )
    for f in stats["failed"]:
        print("  ! feed failed:", f["name"], "-", f["error"])

    if args.dry_run:
        print("dry-run: feed.json not written")
        return 0

    os.makedirs(os.path.dirname(FEED_PATH), exist_ok=True)
    with open(FEED_PATH, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=1)
    print("wrote", os.path.relpath(FEED_PATH, ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
