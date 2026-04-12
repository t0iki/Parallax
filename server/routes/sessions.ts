import { execSync } from "node:child_process";
import type http from "node:http";
import db from "../db.js";
import {
	tmuxListTicketSessions,
	tmuxSendKeys,
	tmuxSessionExists,
} from "../services/tmux.js";
import { json, readBody } from "../utils.js";

export async function handleSessions(
	req: http.IncomingMessage,
	res: http.ServerResponse,
	url: URL,
	defaultCwd: string,
): Promise<boolean> {
	// GET /api/sessions
	if (req.method === "GET" && url.pathname === "/api/sessions") {
		const sessionNames = tmuxListTicketSessions();
		const sessions = sessionNames.map((sessionName) => {
			const ticketId = sessionName.replace("plx-ticket-", "");
			const ticket = db
				.prepare("SELECT id, title FROM tickets WHERE id = ?")
				.get(ticketId) as { id: string; title: string } | undefined;
			let cwd = defaultCwd;
			try {
				cwd = execSync(
					`tmux display-message -t ${sessionName} -p '#{pane_current_path}' 2>/dev/null`,
				)
					.toString()
					.trim();
			} catch {
				// ignore
			}
			return {
				ticketId,
				sessionName,
				cwd,
				title: ticket?.title ?? ticketId,
			};
		});
		json(res, 200, sessions);
		return true;
	}

	// POST /api/sessions/main/send-keys
	if (
		req.method === "POST" &&
		url.pathname === "/api/sessions/main/send-keys"
	) {
		if (!tmuxSessionExists("plx-main")) {
			json(res, 400, { error: "Main session not found" });
			return true;
		}
		const body = JSON.parse(await readBody(req));
		try {
			tmuxSendKeys("plx-main", body.text ?? "");
			json(res, 200, { ok: true });
		} catch (err) {
			json(res, 500, {
				error: `send-keys failed: ${err instanceof Error ? err.message : String(err)}`,
			});
		}
		return true;
	}

	return false;
}
