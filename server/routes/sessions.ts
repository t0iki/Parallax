import { execSync } from "node:child_process";
import type http from "node:http";
import db from "../db.js";
import {
	tmuxListTicketSessions,
	tmuxSendKeys,
	tmuxSessionExists,
} from "../services/tmux.js";
import { json, readBody } from "../utils.js";

// セッションの最終出力ハッシュと更新時刻を追跡
const lastOutputMap = new Map<string, { hash: string; updatedAt: number }>();
const IDLE_THRESHOLD_MS = 60_000; // 1分

function detectSessionStatus(
	sessionName: string,
): "idle" | "working" | "error" {
	try {
		const output = execSync(
			`tmux capture-pane -t "${sessionName}" -p -S -5 2>/dev/null`,
		)
			.toString()
			.trim();

		if (
			output.includes("Unable to connect") ||
			output.includes("ConnectionRefused")
		) {
			return "error";
		}

		// 出力が変化したかチェック
		const prev = lastOutputMap.get(sessionName);
		const now = Date.now();
		if (prev?.hash === output) {
			// 出力が変わっていない → 経過時間をチェック
			if (now - prev.updatedAt > IDLE_THRESHOLD_MS) {
				return "idle";
			}
		} else {
			// 出力が変化した → 更新時刻をリセット
			lastOutputMap.set(sessionName, { hash: output, updatedAt: now });
		}
		return "working";
	} catch {
		return "working";
	}
}

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
			const status = detectSessionStatus(sessionName);
			return {
				ticketId,
				sessionName,
				cwd,
				title: ticket?.title ?? ticketId,
				status,
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
