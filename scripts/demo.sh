#!/usr/bin/env bash
# scripts/demo.sh — one-command demo for MCP Test Bench
# Usage: pnpm demo   (or: bash scripts/demo.sh)
#
# Prerequisites:
#   - ANTHROPIC_API_KEY set in environment
#   - Node >= 20, pnpm, npx available
#
# NOTE: First run downloads three MCP servers via npx -y which can take
# 30-60 s each on a cold machine. Total runtime ~3-5 min.
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ── 1. Guard: require API key ─────────────────────────────────────────────────
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo ""
  echo "  ERROR: ANTHROPIC_API_KEY is not set."
  echo ""
  echo "  Export it first:"
  echo "    export ANTHROPIC_API_KEY=sk-ant-..."
  echo ""
  exit 1
fi

echo ""
echo "══════════════════════════════════════════════"
echo "  MCP Test Bench — demo setup"
echo "══════════════════════════════════════════════"
echo ""

# ── 2. Build the CLI ──────────────────────────────────────────────────────────
echo "▶ Building CLI..."
pnpm --filter @mcp-test-bench/cli build
echo "  ✓ CLI built"
echo ""

CLI="node $REPO_ROOT/apps/cli/dist/index.js"

# ── 3. Seed the demo SQLite database for the sqlite MCP server ────────────────
echo "▶ Creating demo database (examples/demo/sample.db)..."
node "$REPO_ROOT/scripts/create-demo-db.mjs"
echo "  ✓ sample.db ready"
echo ""

DEMO_DB="$REPO_ROOT/demo.db"

# ── 4. Run evaluations ────────────────────────────────────────────────────────
run_server() {
  local label="$1"
  local config="$2"
  echo "▶ Evaluating: $label"
  if $CLI run "$config" --db "$DEMO_DB"; then
    echo "  ✓ $label done"
  else
    echo "  ⚠ $label eval finished with errors (partial results saved)"
  fi
  echo ""
}

# 4a. Filesystem server
run_server "Filesystem Server" "$REPO_ROOT/examples/demo/filesystem-server.yaml"

# 4b. Everything server
run_server "Everything Server" "$REPO_ROOT/examples/demo/everything-server.yaml"

# 4c. SQLite server — path to sample.db must be absolute, so generate YAML inline
SAMPLE_DB="$REPO_ROOT/examples/demo/sample.db"
SQLITE_YAML_TMP="$(mktemp /tmp/mcpbench-sqlite-XXXXXX.yaml)"
cat > "$SQLITE_YAML_TMP" <<YAML
server:
  name: SQLite Server
  type: stdio
  command: npx
  args: ["-y", "@modelcontextprotocol/server-sqlite", "$SAMPLE_DB"]
rubric: general
scenarios:
  generate: 3
YAML
run_server "SQLite Server" "$SQLITE_YAML_TMP"
rm -f "$SQLITE_YAML_TMP"

# ── 5. Done ───────────────────────────────────────────────────────────────────
echo "══════════════════════════════════════════════"
echo "  Demo data written to: demo.db"
echo ""
echo "  Start the dashboard:"
echo ""
echo "    DATABASE_PATH=demo.db pnpm --filter @mcp-test-bench/web dev"
echo ""
echo "  Then open: http://localhost:3000"
echo "══════════════════════════════════════════════"
echo ""
