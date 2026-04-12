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
	// Claude Code は /quit 時に以下の形式で出力:
	// "claude --resume 08435ac3-7caa-4dc9-b5a1-3ee9bd938896"
	const match = output.match(/claude\s+--resume\s+([a-f0-9-]{36})/);
	return match?.[1] ?? null;
}

function restartClaude(sessionName: string): void {
	try {
		// ターミナルにメッセージ表示
		execSync(`tmux send-keys -t "${sessionName}" '' Enter 2>/dev/null`);
		execSync(
			`tmux send-keys -t "${sessionName}" 'echo "🔄 [Parallax Watchdog] API接続エラーを検知しました。セッションを再起動します..."' Enter 2>/dev/null`,
		);

		// /quit を送ってセッションIDを取得
		setTimeout(() => {
			execSync(`tmux send-keys -t "${sessionName}" '/quit' Enter 2>/dev/null`);
		}, 1000);

		// /quit の出力を待ってからセッションIDを取得して再起動
		setTimeout(() => {
			const output = capturePaneOutput(sessionName, 30);
			const sessionId = extractSessionId(output);

			const parts = [LAUNCHER, "--dangerously-skip-permissions"];
			if (sessionId) parts.push("--resume", sessionId);
			const cmd = parts.join(" ");

			try {
				const msg = sessionId
					? `[Parallax Watchdog] Resuming session ${sessionId}`
					: "[Parallax Watchdog] Restarting Claude Code";
				execSync(
					`tmux send-keys -t "${sessionName}" "echo '${msg}'" Enter 2>/dev/null`,
				);
				// コマンドをそのまま送信（クォートなし）
				execSync(
					`tmux send-keys -t "${sessionName}" "${cmd}" Enter 2>/dev/null`,
				);
				console.log(
					`[watchdog] Restarted Claude Code in ${sessionName}${sessionId ? ` (resume: ${sessionId})` : ""}`,
				);
			} catch {
				// ignore
			}
		}, 3000);
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
