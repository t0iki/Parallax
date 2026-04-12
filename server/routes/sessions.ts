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
			`tmux capture-pane -t "${sessionName}" -p -S -20 2>/dev/null`,
		)
			.toString()
			.trim();

		const lastLine = output.split("\n").pop() ?? "";
		const prev = lastOutputMap.get(sessionName);
		const now = Date.now();
		let result: "idle" | "working" | "error";

		if (
			output.includes("Unable to connect") ||
			output.includes("ConnectionRefused")
		) {
			result = "error";
		} else if (prev?.hash === output) {
			const elapsed = Math.round((now - prev.updatedAt) / 1000);
			result = now - prev.updatedAt > IDLE_THRESHOLD_MS ? "idle" : "working";
			console.log(
				`[session] ${sessionName}: ${result} (unchanged ${elapsed}s) last: "${lastLine.slice(0, 80)}"`,
			);
			return result;
		} else {
			lastOutputMap.set(sessionName, { hash: output, updatedAt: now });
			result = "working";
		}

		console.log(
			`[session] ${sessionName}: ${result} last: "${lastLine.slice(0, 80)}"`,
		);
		return result;
	} catch {
		return "working";
	}
}

// バックグラウンドで10秒ごとに全セッションの状態を更新
setInterval(() => {
	for (const sessionName of tmuxListTicketSessions()) {
		detectSessionStatus(sessionName);
	}
}, 10_000);

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
