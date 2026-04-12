import { execSync } from "node:child_process";
import type http from "node:http";
import db from "../db.js";
import { tmuxListTicketSessions } from "../services/tmux.js";
import { json } from "../utils.js";

export function handleSessions(
	req: http.IncomingMessage,
	res: http.ServerResponse,
	url: URL,
	defaultCwd: string,
): boolean {
	if (req.method !== "GET" || url.pathname !== "/api/sessions") return false;

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
