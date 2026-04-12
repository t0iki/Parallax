#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

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

echo "Parallax running at http://localhost:5173"
wait
