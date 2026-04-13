import type http from "node:http";
import path from "node:path";
import db from "../db.js";
import {
	deleteBranch,
	getDiffFiles,
	getFileDiff,
	removeWorktree,
} from "../services/git.js";
import { startTicket } from "../services/ticket-start.js";
import {
	tmuxKillSession,
	tmuxSendKeys,
	tmuxSessionExists,
} from "../services/tmux.js";
import { json, readBody } from "../utils.js";

export async function handleTickets(
	req: http.IncomingMessage,
	res: http.ServerResponse,
	url: URL,
): Promise<boolean> {
	// GET /api/tickets
	if (req.method === "GET" && url.pathname === "/api/tickets") {
		const rows = db
			.prepare(
				`SELECT id, title, description, source_url as sourceUrl,
				        parent_id as parentId, status, base_commit as baseCommit,
				        work_directory_id as workDirectoryId, worktree_path as worktreePath,
				        start_phase as startPhase, created_at as createdAt
				 FROM tickets ORDER BY created_at`,
			)
			.all() as Record<string, unknown>[];
		const tdRows = db
			.prepare("SELECT ticket_id, directory_id FROM ticket_directories")
			.all() as { ticket_id: string; directory_id: string }[];
		const dirMap = new Map<string, string[]>();
		for (const r of tdRows) {
			const list = dirMap.get(r.ticket_id) ?? [];
			list.push(r.directory_id);
			dirMap.set(r.ticket_id, list);
		}
		const result = rows.map((row) => ({
			...row,
			directoryIds: dirMap.get(row.id as string) ?? [],
		}));
		json(res, 200, result);
		return true;
	}

	// POST /api/tickets
	if (req.method === "POST" && url.pathname === "/api/tickets") {
		const body = JSON.parse(await readBody(req));
		db.prepare(
			`INSERT INTO tickets (id, title, description, source_url, parent_id, status, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		).run(
			body.id,
			body.title,
			body.description ?? "",
			body.sourceUrl ?? null,
			body.parentId ?? null,
			body.status,
			body.createdAt,
		);
		json(res, 201, body);
		return true;
	}

	// GET /api/tickets/dependencies
	if (req.method === "GET" && url.pathname === "/api/tickets/dependencies") {
		const rows = db
			.prepare(
				`SELECT id, from_ticket_id as fromTicketId, to_ticket_id as toTicketId,
				        created_at as createdAt
				 FROM ticket_dependencies ORDER BY created_at`,
			)
			.all();
		json(res, 200, rows);
		return true;
	}

	// POST /api/tickets/dependencies
	if (req.method === "POST" && url.pathname === "/api/tickets/dependencies") {
		const body = JSON.parse(await readBody(req));
		const cycle = db
			.prepare(
				`WITH RECURSIVE chain(tid) AS (
				   SELECT ?
				   UNION
				   SELECT d.from_ticket_id FROM ticket_dependencies d
				   JOIN chain c ON d.to_ticket_id = c.tid
				 )
				 SELECT 1 FROM chain WHERE tid = ?`,
			)
			.get(body.fromTicketId, body.toTicketId);
		if (cycle) {
			json(res, 400, { error: "Circular dependency detected" });
			return true;
		}
		db.prepare(
			`INSERT INTO ticket_dependencies (id, from_ticket_id, to_ticket_id, created_at)
			 VALUES (?, ?, ?, ?)`,
		).run(body.id, body.fromTicketId, body.toTicketId, body.createdAt);
		json(res, 201, body);
		return true;
	}

	// DELETE /api/tickets/dependencies/:id
	const depDeleteMatch = url.pathname.match(
		/^\/api\/tickets\/dependencies\/(.+)$/,
	);
	if (req.method === "DELETE" && depDeleteMatch) {
		const id = depDeleteMatch[1];
		db.prepare("DELETE FROM ticket_dependencies WHERE id = ?").run(id);
		json(res, 200, { id });
		return true;
	}

	// PATCH /api/tickets/:id
	const patchMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)$/);
	if (req.method === "PATCH" && patchMatch) {
		const id = patchMatch[1];
		const body = JSON.parse(await readBody(req));
		const fields: string[] = [];
		const values: unknown[] = [];
		if (body.status !== undefined) {
			fields.push("status = ?");
			values.push(body.status);
		}
		if (body.title !== undefined) {
			fields.push("title = ?");
			values.push(body.title);
		}
		if (body.description !== undefined) {
			fields.push("description = ?");
			values.push(body.description);
		}
		if (fields.length > 0) {
			values.push(id);
			db.prepare(`UPDATE tickets SET ${fields.join(", ")} WHERE id = ?`).run(
				...values,
			);
			// サブタスクのステータスも親に連動
			if (body.status !== undefined) {
				db.prepare(
					"UPDATE tickets SET status = ? WHERE parent_id = ?",
				).run(body.status, id);
			}
		}
		json(res, 200, { id, ...body });
		return true;
	}

	// DELETE /api/tickets/:id
	const deleteMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)$/);
	if (req.method === "DELETE" && deleteMatch) {
		const id = deleteMatch[1];
		const ticketInfo = db
			.prepare(
				"SELECT worktree_path, work_directory_id, branch_name FROM tickets WHERE id = ?",
			)
			.get(id) as
			| {
					worktree_path: string | null;
					work_directory_id: string | null;
					branch_name: string | null;
			  }
			| undefined;

		tmuxKillSession(`plx-ticket-${id}`);

		if (ticketInfo?.worktree_path && ticketInfo.work_directory_id) {
			const dir = db
				.prepare("SELECT path FROM directories WHERE id = ?")
				.get(ticketInfo.work_directory_id) as { path: string } | undefined;
			if (dir) {
				removeWorktree(dir.path, ticketInfo.worktree_path);
				if (ticketInfo.branch_name) {
					deleteBranch(dir.path, ticketInfo.branch_name);
				}
			}
		}

		db.prepare("DELETE FROM tickets WHERE id = ?").run(id);
		json(res, 200, { id });
		return true;
	}

	// POST /api/tickets/:id/start
	const startMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)\/start$/);
	if (req.method === "POST" && startMatch) {
		const ticketId = startMatch[1];
		const body = JSON.parse(await readBody(req));
		const result = startTicket({
			ticketId,
			directoryId: body.directoryId,
			addDirectoryIds: body.addDirectoryIds,
		});
		if (!result) {
			json(res, 404, { error: "Ticket or directory not found" });
			return true;
		}
		json(res, 200, result);
		return true;
	}

	// POST /api/tickets/:id/reset — TODOに戻す（worktree/ブランチ/tmux削除）
	const resetMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)\/reset$/);
	if (req.method === "POST" && resetMatch) {
		const id = resetMatch[1];
		const ticketInfo = db
			.prepare(
				"SELECT worktree_path, work_directory_id, branch_name FROM tickets WHERE id = ?",
			)
			.get(id) as
			| {
					worktree_path: string | null;
					work_directory_id: string | null;
					branch_name: string | null;
			  }
			| undefined;
		if (!ticketInfo) {
			json(res, 404, { error: "Ticket not found" });
			return true;
		}

		tmuxKillSession(`plx-ticket-${id}`);

		if (ticketInfo.worktree_path && ticketInfo.work_directory_id) {
			const dir = db
				.prepare("SELECT path FROM directories WHERE id = ?")
				.get(ticketInfo.work_directory_id) as { path: string } | undefined;
			if (dir) {
				removeWorktree(dir.path, ticketInfo.worktree_path);
				if (ticketInfo.branch_name) {
					deleteBranch(dir.path, ticketInfo.branch_name);
				}
			}
		}

		db.prepare(
			"UPDATE tickets SET status = ?, start_phase = NULL, base_commit = NULL, work_directory_id = NULL, worktree_path = NULL, branch_name = NULL WHERE id = ?",
		).run("todo", id);

		json(res, 200, { id });
		return true;
	}

	// POST /api/tickets/:id/send-keys
	const sendKeysMatch = url.pathname.match(
		/^\/api\/tickets\/([^/]+)\/send-keys$/,
	);
	if (req.method === "POST" && sendKeysMatch) {
		const ticketId = sendKeysMatch[1];
		const body = JSON.parse(await readBody(req));
		const sessionName = `plx-ticket-${ticketId}`;
		if (!tmuxSessionExists(sessionName)) {
			json(res, 400, { error: "Session not found" });
			return true;
		}
		try {
			tmuxSendKeys(sessionName, body.text ?? "");
			json(res, 200, { ok: true });
		} catch (err) {
			json(res, 500, {
				error: `send-keys failed: ${err instanceof Error ? err.message : String(err)}`,
			});
		}
		return true;
	}

	// GET /api/tickets/:id/diff
	const diffListMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)\/diff$/);
	if (req.method === "GET" && diffListMatch) {
		const ticketId = diffListMatch[1];
		const ticket = db
			.prepare(
				"SELECT base_commit, worktree_path, work_directory_id FROM tickets WHERE id = ?",
			)
			.get(ticketId) as
			| {
					base_commit: string | null;
					worktree_path: string | null;
					work_directory_id: string | null;
			  }
			| undefined;
		if (!ticket?.base_commit) {
			json(res, 400, { error: "No base commit recorded" });
			return true;
		}
		const diffCwd = resolveDiffCwd(ticket);
		if (!diffCwd) {
			json(res, 400, { error: "No working directory" });
			return true;
		}
		try {
			const files = getDiffFiles(diffCwd, ticket.base_commit);
			json(res, 200, { baseCommit: ticket.base_commit, files });
		} catch (err) {
			json(res, 500, {
				error: `git diff failed: ${err instanceof Error ? err.message : String(err)}`,
			});
		}
		return true;
	}

	// GET /api/tickets/:id/diff/:filePath
	const diffFileMatch = url.pathname.match(
		/^\/api\/tickets\/([^/]+)\/diff\/(.+)$/,
	);
	if (req.method === "GET" && diffFileMatch) {
		const ticketId = diffFileMatch[1];
		const filePath = decodeURIComponent(diffFileMatch[2]);
		const ticket = db
			.prepare(
				"SELECT base_commit, worktree_path, work_directory_id FROM tickets WHERE id = ?",
			)
			.get(ticketId) as
			| {
					base_commit: string | null;
					worktree_path: string | null;
					work_directory_id: string | null;
			  }
			| undefined;
		if (!ticket?.base_commit) {
			json(res, 400, { error: "No base commit recorded" });
			return true;
		}
		const diffCwd = resolveDiffCwd(ticket);
		if (!diffCwd) {
			json(res, 400, { error: "No working directory" });
			return true;
		}
		const resolved = path.resolve(diffCwd, filePath);
		if (!resolved.startsWith(path.resolve(diffCwd))) {
			json(res, 400, { error: "Invalid file path" });
			return true;
		}
		try {
			const output = getFileDiff(diffCwd, ticket.base_commit, filePath);
			res.writeHead(200, { "Content-Type": "text/plain" });
			res.end(output);
		} catch (err) {
			json(res, 500, {
				error: `git diff failed: ${err instanceof Error ? err.message : String(err)}`,
			});
		}
		return true;
	}

	return false;
}

function resolveDiffCwd(ticket: {
	worktree_path: string | null;
	work_directory_id: string | null;
}): string | null {
	if (ticket.worktree_path) return ticket.worktree_path;
	if (ticket.work_directory_id) {
		const dir = db
			.prepare("SELECT path FROM directories WHERE id = ?")
			.get(ticket.work_directory_id) as { path: string } | undefined;
		return dir?.path ?? null;
	}
	return null;
}
