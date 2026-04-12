#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

# --verbose フラグを環境変数に変換
export PLX_VERBOSE=""
for arg in "$@"; do
  if [ "$arg" = "--verbose" ] || [ "$arg" = "-v" ]; then
    export PLX_VERBOSE=1
  fi
done

cleanup() {
  kill $SERVER_PID $VITE_PID 2>/dev/null
  wait $SERVER_PID $VITE_PID 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

npx tsx watch server/index.ts &
SERVER_PID=$!

npx vite &
VITE_PID=$!

echo "Parallax running at http://localhost:24511"
wait
