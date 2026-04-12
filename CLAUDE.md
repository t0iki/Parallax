# Parallax

ブラウザ上でターミナル（Claude Code）とカンバンボードを並べて使えるアプリケーション。

## チケット管理

「チケットを作成して」「Todoに追加して」などの指示があった場合、**必ず** MCPツール `plx-todo` の `create_ticket` を使ってアプリ内のカンバンボードに追加すること。確認や質問は不要で、即座に作成する。GitHub IssueやLinearなど外部サービスへの作成は、ユーザーが明示的に指定した場合のみ行う。

### GitHub Issue からのチケット作成

GitHub IssueのURLが与えられた場合:
1. `create_ticket_from_github_issue` でメインチケットを作成
2. レスポンスに含まれるIssue本文を読み、サブタスクに分解
3. 各サブタスクを `create_ticket` で `parentId` を指定して作成
4. 必要に応じて `add_dependency` で実行順序を設定

### 重要: GitHub APIアクセスについて

GitHub の情報取得やPR作成には `gh` CLI ではなく、**必ず MCPツールを使うこと**。Socket Firewall のプロキシ環境下では `gh` CLI の TLS 検証が失敗するが、MCPツールは `NODE_EXTRA_CA_CERTS` で対応済み。

### 利用可能なMCPツール (plx-todo)

- `create_ticket` — チケットを作成 (title, description, status, parentId, sourceUrl)
- `list_tickets` — チケット一覧を取得
- `update_ticket` — チケットを更新 (id, status, title, description)
- `update_ticket_status` — ステータスを変更 (id, status)
- `delete_ticket` — チケットを削除 (id)
- `fetch_github_issue` — GitHub IssueのURLから内容を取得
- `create_ticket_from_github_issue` — GitHub Issueからチケットを作成 (url, status, parentId)
- `add_dependency` — チケット間の依存関係を追加 (fromTicketId, toTicketId)
- `remove_dependency` — 依存関係を削除 (id)
- `list_dependencies` — 依存関係一覧を取得
- `create_pull_request` — GitHub PRを作成 (owner, repo, head, base, title, body)

## 開発

- パッケージマネージャ: pnpm
- フロントエンド: Vite + React + TypeScript
- リンター/フォーマッター: Biome
- バックエンド: Node.js (tsx) + SQLite (node:sqlite)
- `pnpm dev` — Vite開発サーバー
- `pnpm dev:server` — APIサーバー + PTY WebSocketサーバー
