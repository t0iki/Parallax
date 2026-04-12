import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DB_PATH = path.join(import.meta.dirname, "..", "data", "zanki.db");

const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo',
    created_at INTEGER NOT NULL
  )
`);

// マイグレーション: 新カラム追加
for (const sql of [
	"ALTER TABLE tickets ADD COLUMN description TEXT NOT NULL DEFAULT ''",
	"ALTER TABLE tickets ADD COLUMN source_url TEXT",
	"ALTER TABLE tickets ADD COLUMN parent_id TEXT REFERENCES tickets(id) ON DELETE CASCADE",
	"ALTER TABLE tickets ADD COLUMN base_commit TEXT",
	"ALTER TABLE tickets ADD COLUMN work_directory_id TEXT REFERENCES directories(id)",
	"ALTER TABLE tickets ADD COLUMN worktree_path TEXT",
	"ALTER TABLE tickets ADD COLUMN start_phase TEXT",
	"ALTER TABLE tickets ADD COLUMN branch_name TEXT",
]) {
	try {
		db.exec(sql);
	} catch {
		// カラムが既に存在する場合はスキップ
	}
}

db.exec(`
  CREATE TABLE IF NOT EXISTS ticket_dependencies (
    id TEXT PRIMARY KEY,
    from_ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    to_ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    UNIQUE(from_ticket_id, to_ticket_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS directories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

for (const sql of [
	"ALTER TABLE directories ADD COLUMN main_branch TEXT NOT NULL DEFAULT 'main'",
	"ALTER TABLE directories ADD COLUMN branch_template TEXT NOT NULL DEFAULT '{title}'",
]) {
	try {
		db.exec(sql);
	} catch {
		// カラムが既に存在する場合はスキップ
	}
}

db.exec(`
  CREATE TABLE IF NOT EXISTS ticket_directories (
    ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    directory_id TEXT NOT NULL REFERENCES directories(id) ON DELETE CASCADE,
    PRIMARY KEY (ticket_id, directory_id)
  )
`);

export default db;
