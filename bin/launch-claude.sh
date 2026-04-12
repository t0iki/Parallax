#!/bin/bash
# Claude Code を確実に起動するラッパースクリプト
# ログインシェルの環境を完全にロードしてからClaude Codeを起動する

# ログインシェル環境をソース（.zprofile, .zshrc等）
if [ -f "$HOME/.zprofile" ]; then
  source "$HOME/.zprofile" 2>/dev/null
fi
if [ -f "$HOME/.zshrc" ]; then
  source "$HOME/.zshrc" 2>/dev/null
fi

# mise が使える場合はアクティベート
if command -v mise &>/dev/null; then
  eval "$(mise activate bash 2>/dev/null)" || true
fi

# Claude Code の接続テスト（最大3回リトライ）
MAX_RETRIES=3
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
  if claude --version &>/dev/null; then
    break
  fi
  RETRY=$((RETRY + 1))
  echo "Claude Code connection check failed, retrying ($RETRY/$MAX_RETRIES)..."
  sleep 2
done

# Claude Code を起動（引数をそのまま渡す）
exec claude "$@"
