name: collect-hormuz-osint

# Near-real-time collection.
# GitHub Actions schedule runs at approximately 15-minute granularity
# and may be delayed under load.
#
# For true continuous collection, run collector/collect.py
# on a dedicated host, VPS, container, or local scheduler.

on:
  schedule:
    - cron: "*/15 * * * *"

  workflow_dispatch: {}

  push:
    branches:
      - main
    paths:
      - "collector/**"
      - ".github/workflows/collect.yml"

# Prevent overlapping collection runs.
# A newer run replaces an older queued/running collection.
concurrency:
  group: collect
  cancel-in-progress: true

permissions:
  contents: write

jobs:
  collect:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: requirements.txt

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          python -m pip install --no-cache-dir -r requirements.txt

      - name: Run collector
        run: |
          python collector/collect.py

      - name: Validate feed.json
        run: |
          if [ ! -f "docs/data/feed.json" ]; then
            echo "ERROR: docs/data/feed.json was not generated."
            exit 1
          fi

          python - <<'PY'
          import json
          from pathlib import Path

          path = Path("docs/data/feed.json")

          try:
              data = json.loads(path.read_text(encoding="utf-8"))
          except Exception as exc:
              print(f"ERROR: Invalid JSON: {exc}")
              raise SystemExit(1)

          if not isinstance(data, dict):
              print("ERROR: feed.json must contain a JSON object.")
              raise SystemExit(1)

          if "items" not in data:
              print("ERROR: feed.json is missing 'items'.")
              raise SystemExit(1)

          if not isinstance(data["items"], list):
              print("ERROR: 'items' must be a list.")
              raise SystemExit(1)

          print(f"Valid feed.json: {len(data['items'])} items")
          PY

      - name: Commit updated feed
        run: |
          git config user.name "hormuz-osint-bot"
          git config user.email "actions@users.noreply.github.com"

          git add docs/data/feed.json

          if git diff --cached --quiet; then
            echo "No new items - nothing to commit."
            exit 0
          fi

          git commit -m "feed: refresh $(date -u '+%Y-%m-%d %H:%M UTC')"

          git pull --rebase origin main

          git push origin HEAD:main
