#!/bin/bash
# Socket Firewall の CA 証明書を自動検出
SFW_CA=$(find /var/folders -maxdepth 5 -name "socketFirewallCa.crt" -path "*/sfw-*" 2>/dev/null | head -1)

if [ -n "$SFW_CA" ]; then
  export NODE_EXTRA_CA_CERTS="$SFW_CA"
fi

# gh CLI からGitHubトークンを取得（プライベートリポジトリ用）
if [ -z "$GITHUB_TOKEN" ]; then
  TOKEN=$(gh auth token 2>/dev/null)
  if [ -n "$TOKEN" ]; then
    export GITHUB_TOKEN="$TOKEN"
  fi
fi

exec "$(dirname "$0")/../node_modules/.bin/tsx" "$(dirname "$0")/mcp.ts"
