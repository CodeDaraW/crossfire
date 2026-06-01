#!/bin/bash
set -euo pipefail

echo "=== Crossfire Harness Initialization ==="

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

NODE_BIN="${NODE_BIN:-}"
if [ -z "$NODE_BIN" ] && command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
fi
if [ -z "$NODE_BIN" ] && [ -x "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]; then
  NODE_BIN="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [ -z "$NODE_BIN" ]; then
  echo "ERROR: node not found. Install Node.js >= 18 or set NODE_BIN." >&2
  exit 1
fi

echo "node: $("$NODE_BIN" --version)"
export PATH="$(dirname "$NODE_BIN"):$PATH"

if command -v npm >/dev/null 2>&1; then
  echo "=== npm install ==="
  npm install

  echo "=== npm test ==="
  npm test

  echo "=== npm run smoke ==="
  npm run smoke
else
  echo "=== npm unavailable; using direct node verification ==="
  echo "No npm dependencies are required by package.json."

  echo "=== unit tests ==="
  "$NODE_BIN" --test tests/*.test.mjs

  echo "=== smoke tests ==="
  "$NODE_BIN" scripts/smoke.mjs
fi

echo "=== Verification Complete ==="
echo ""
echo "Next steps:"
echo "1. Read feature_list.json to see current feature state"
echo "2. Pick ONE unfinished feature to work on"
echo "3. Implement only that feature"
echo "4. Re-run ./init.sh before claiming done"
