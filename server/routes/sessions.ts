import { execSync } from "node:child_process";
import type http from "node:http";
import db from "../db.js";
import { emitNotification } from "../services/notifications.js";
import {
	tmuxListTicketSessions,
	tmuxSendKeys,
	tmuxSessionExists,
} from "../services/tmux.js";
import { json, readBody } from "../utils.js";

type Status = "idle" | "working" | "error";

const lastOutputMap = new Map<string, { hash: string; updatedAt: number }>();
const lastStatusMap = new Map<string, Status>();
const emittedPRs = new Set<string>(); // key: `${sessionName}:${url}`
const IDLE_THRESHOLD_MS = 60_000; // 1分
const PR_URL_RE = /https:\/\/github\.com\/[^\s]+?\/pull\/\d+/g;

const verbose = !!process.env.PLX_VERBOSE;

function getTicketTitle(ticketId: string): string {
	const ticket = db
		.prepare("SELECT title FROM tickets WHERE id = ?")
		.get(ticketId) as { title: string } | undefined;
	return ticket?.title ?? ticketId.slice(0, 8);
}

function detectSessionStatus(sessionName: string): Status {
	try {
		const output = execSync(
			`tmux capture-pane -t "${sessionName}" -p -S -200 2>/dev/null`,
		)
			.toString()
			.trim();

		const ticketId = sessionName.replace("plx-ticket-", "");
		const title = getTicketTitle(ticketId);

		// PR URL 検知 (新規のみ発火)
		const urls = output.match(PR_URL_RE);
		if (urls) {
			for (const url of urls) {
				const key = `${sessionName}:${url}`;
				if (!emittedPRs.has(key)) {
					emittedPRs.add(key);
					emitNotification({
						type: "pr_created",
						ticketId,
						sessionName,
						title,
						url,
						at: Date.now(),
					});
				}
			}
		}

		let status: Status;
		if (
			output.includes("Unable to connect") ||
			output.includes("ConnectionRefused")
		) {
			if (verbose) console.log(`[session] "${title}": error`);
			status = "error";
		} else {
			const prev = lastOutputMap.get(sessionName);
			const now = Date.now();

			if (prev?.hash === output) {
				const elapsed = Math.round((now - prev.updatedAt) / 1000);
				status =
					now - prev.updatedAt > IDLE_THRESHOLD_MS ? "idle" : "working";
				if (verbose)
					console.log(`[session] "${title}": ${status} (${elapsed}s)`);
			} else {
				lastOutputMap.set(sessionName, { hash: output, updatedAt: now });
				if (verbose) console.log(`[session] "${title}": working (changed)`);
				status = "working";
			}
		}

		// ステータス遷移イベント発火
		const prevStatus = lastStatusMap.get(sessionName);
		if (prevStatus !== status) {
			lastStatusMap.set(sessionName, status);
			if (status === "idle" && prevStatus === "working") {
				emitNotification({
					type: "idle",
					ticketId,
					sessionName,
					title,
					at: Date.now(),
				});
			} else if (status === "error" && prevStatus !== "error") {
				emitNotification({
					type: "error",
					ticketId,
					sessionName,
					title,
					at: Date.now(),
				});
			}
		}

		return status;
	} catch {
		return "working";
	}
}

// セッション消失(stopped)検知用
const knownSessions = new Set<string>();

// バックグラウンドで10秒ごとに全セッションの状態を更新
setInterval(() => {
	const current = new Set(tmuxListTicketSessions());

	// 消えたセッション → stopped イベント
	for (const sessionName of knownSessions) {
		if (!current.has(sessionName)) {
			const ticketId = sessionName.replace("plx-ticket-", "");
			emitNotification({
				type: "stopped",
				ticketId,
				sessionName,
				title: getTicketTitle(ticketId),
				at: Date.now(),
			});
			lastOutputMap.delete(sessionName);
			lastStatusMap.delete(sessionName);
		}
	}
	knownSessions.clear();
	for (const s of current) {
		knownSessions.add(s);
		detectSessionStatus(s);
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
