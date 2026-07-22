#!/usr/bin/env bash
# docs/record_demo.sh — record a terminal demo GIF with asciinema + agg
#
# Prerequisites:
#   asciinema:  pip install asciinema         (https://asciinema.org)
#   agg:        cargo install agg             (https://github.com/asciinema/agg)
#               or: brew install agg
#
# Usage:
#   export ANTHROPIC_API_KEY=sk-ant-...
#   bash docs/record_demo.sh
#
# Output:
#   docs/demo.cast  — raw asciinema recording
#   docs/demo.gif   — animated GIF (overwrites placeholder)
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CAST="$REPO_ROOT/docs/demo.cast"
GIF="$REPO_ROOT/docs/demo.gif"

echo "Recording demo session..."
asciinema rec --overwrite "$CAST" --command "bash $REPO_ROOT/scripts/demo.sh"

echo "Converting to GIF..."
agg --font-size 14 --speed 1.5 "$CAST" "$GIF"

echo ""
echo "Saved: $GIF"
echo "Commit with: git add docs/demo.cast docs/demo.gif"
