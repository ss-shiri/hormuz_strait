#!/usr/bin/env python3
"""
Hormuz OSINT Monitor – Collector
Optimized + Safe + GitHub Actions–friendly
"""

import os
import json
import time
import hashlib
import feedparser
import yaml
from datetime import datetime, timedelta
from dateutil import parser as dateparser
import requests

# -----------------------------
# CONSTANTS
# -----------------------------
HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, ".."))
FEED_PATH = os.path.join(ROOT, "docs", "data", "feed.json")

MAX_ITEMS = 200
MAX_AGE_DAYS = 14
REQUEST_TIMEOUT = 10

USER_AGENT = (
    "Mozilla/5.0 (Hormuz-OSINT-Collector; +https://ss-shiri.github.io/hormuz_strait)"
)

# -----------------------------
# HELPERS
# -----------------------------

def load_yaml(path):
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def clean_text(s):
    if not s:
        return ""
    return " ".join(s.split())

def domain_of(url):
    try:
        return url.split("/")[2]
    except Exception:
        return ""

def item_id(url):
    return hashlib.md5(url.encode("utf-8")).hexdigest()[:16]

def parse_date(dt):
    try:
        return dateparser.parse(dt)
    except Exception:
        return None

def fetch(url):
    try:
        r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT)
        r.raise_for_status()
        return r.text
    except Exception as e:
        print(f"[WARN] fetch failed: {url} ({e})")
        return None

# -----------------------------
# MAIN COLLECTION LOGIC
# -----------------------------

def collect():
    sources = load_yaml(os.path.join(HERE, "sources.yaml"))
    keywords = load_yaml(os.path.join(HERE, "keywords.yaml"))
    reliability = load_yaml(os.path.join(HERE, "reliability.yaml"))

    items = []
    sources_ok = []
    sources_failed = []

    for src in sources:
        url = src.get("url")
        name = src.get("name")

        print(f"[INFO] Fetching: {name} → {url}")
        xml = fetch(url)

        if not xml:
            sources_failed.append(name)
            continue

        parsed = feedparser.parse(xml)
        if not parsed.entries:
            sources_failed.append(name)
            continue

        sources_ok.append(name)

        for entry in parsed.entries:
            link = entry.get("link")
            if not link:
                continue

            published = entry.get("published") or entry.get("updated")
            dt = parse_date(published)
            if not dt:
                continue

            if dt < datetime.utcnow() - timedelta(days=MAX_AGE_DAYS):
                continue

            item = {
                "id": item_id(link),
                "title": clean_text(entry.get("title")),
                "summary": clean_text(entry.get("summary")),
                "link": link,
                "lang": src.get("lang", "en"),
                "source": name,
                "domain": domain_of(link),
                "feed": name,
                "category": src.get("category", "news"),
                "confidence": reliability.get(name, "low"),
                "reliability_letter": reliability.get(name, "E"),
                "published": dt.isoformat(),
                "published_ts": int(dt.timestamp()),
                "keywords": keywords.get("default", []),
            }

            items.append(item)

    return items, sources_ok, sources_failed

# -----------------------------
# MERGE + PRUNE
# -----------------------------

def load_existing():
    if not os.path.exists(FEED_PATH):
        return {"meta": {}, "items": []}
    try:
        with open(FEED_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        print("[WARN] existing feed.json invalid → starting fresh")
        return {"meta": {}, "items": []}

def merge_and_prune(existing, new_items):
    seen = {i["id"]: i for i in existing.get("items", [])}

    for item in new_items:
        seen[item["id"]] = item

    merged = list(seen.values())
    merged.sort(key=lambda x: x["published_ts"], reverse=True)
    merged = merged[:MAX_ITEMS]

    return merged

# -----------------------------
# MAIN
# -----------------------------

def main():
    print("[INFO] Starting collector…")

    new_items, ok, failed = collect()
    existing = load_existing()
    merged = merge_and_prune(existing, new_items)

    feed = {
        "meta": {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "count": len(merged),
            "new_this_run": len(new_items),
            "sources_ok": ok,
            "sources_failed": failed,
            "verified": False,
            "seed": False,
        },
        "items": merged,
    }

    with open(FEED_PATH, "w", encoding="utf-8") as f:
        json.dump(feed, f, ensure_ascii=False, indent=2)

    print(f"[INFO] Wrote feed.json ({len(merged)} items) → {FEED_PATH}")

if __name__ == "__main__":
    main()
