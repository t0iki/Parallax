import { execSync } from "node:child_process";
import path from "node:path";
import { tmuxListTicketSessions, tmuxSessionExists } from "./tmux.js";

const PLX_DIR = import.meta.dirname
	? path.join(import.meta.dirname, "..", "..")
	: process.cwd();

const LAUNCHER = path.join(PLX_DIR, "bin", "launch-claude.sh");

function capturePaneOutput(sessionName: string, lines = 20): string {
	try {
		return execSync(
			`tmux capture-pane -t "${sessionName}" -p -S -${lines} 2>/dev/null`,
		).toString();
	} catch {
		return "";
	}
}

function extractSessionId(output: string): string | null {
	// Claude Code は /quit 時や起動時に session id を表示する
	// 例: "Session ID: abc123..." や "session: abc123"
	const match = output.match(
		/(?:Session ID|session|Resumed session|Session started)[\s:]+([a-f0-9-]{36}|[a-f0-9]{8,})/i,
	);
	return match?.[1] ?? null;
}

function restartClaude(sessionName: string): void {
	try {
		// まず /quit を送ってセッションIDを取得
		execSync(`tmux send-keys -t "${sessionName}" '/quit' Enter 2>/dev/null`);

		// /quit の出力を待ってからセッションIDを取得
		setTimeout(() => {
			const output = capturePaneOutput(sessionName, 30);
			const sessionId = extractSessionId(output);

			const resumeFlag = sessionId ? `--resume "${sessionId}"` : "";
			const cmd =
				`${LAUNCHER} --dangerously-skip-permissions ${resumeFlag}`.trim();

			try {
				execSync(
					`tmux send-keys -t "${sessionName}" '${cmd.replace(/'/g, "'\\''")}' Enter 2>/dev/null`,
				);
				console.log(
					`[watchdog] Restarted Claude Code in ${sessionName}${sessionId ? ` (resume: ${sessionId})` : ""}`,
				);
			} catch {
				// ignore
			}
		}, 2000);
	} catch {
		// ignore
	}
}

const ERROR_PATTERNS = [
	"Unable to connect to API",
	"ConnectionRefused",
	"unable to connect",
];

// 直近で再起動したセッションを記録（連続再起動を防ぐ）
const recentRestarts = new Map<string, number>();
const RESTART_COOLDOWN_MS = 60000;

function checkSession(sessionName: string): void {
	const lastRestart = recentRestarts.get(sessionName) ?? 0;
	if (Date.now() - lastRestart < RESTART_COOLDOWN_MS) return;

	const output = capturePaneOutput(sessionName);
	for (const pattern of ERROR_PATTERNS) {
		if (output.includes(pattern)) {
			console.log(
				`[watchdog] Detected "${pattern}" in ${sessionName}, restarting...`,
			);
			recentRestarts.set(sessionName, Date.now());
			restartClaude(sessionName);
			return;
		}
	}
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startWatchdog(intervalMs = 10000): void {
	if (intervalId) return;
	console.log(`[watchdog] Started (checking every ${intervalMs / 1000}s)`);
	intervalId = setInterval(() => {
		if (tmuxSessionExists("plx-main")) {
			checkSession("plx-main");
		}
		for (const session of tmuxListTicketSessions()) {
			checkSession(session);
		}
	}, intervalMs);
}

export function stopWatchdog(): void {
	if (intervalId) {
		clearInterval(intervalId);
		intervalId = null;
	}
}
