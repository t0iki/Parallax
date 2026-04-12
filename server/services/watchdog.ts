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

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function restartClaude(sessionName: string): Promise<void> {
	const send = (text: string) => {
		try {
			execSync(
				`tmux send-keys -t "${sessionName}" "${text}" Enter 2>/dev/null`,
			);
		} catch {
			// ignore
		}
	};

	try {
		// Step 1: メッセージ表示
		send(
			"echo '[Parallax Watchdog] API connection error detected. Restarting...'",
		);
		await sleep(1000);

		// Step 2: /quit でセッションIDを取得
		send("/quit");
		await sleep(5000);

		// Step 3: セッションIDを抽出
		const output = capturePaneOutput(sessionName, 30);
		const sessionId = extractSessionId(output);

		// Step 4: 再起動メッセージ
		const msg = sessionId
			? `echo '[Parallax Watchdog] Resuming session ${sessionId}'`
			: "echo '[Parallax Watchdog] Restarting Claude Code'";
		send(msg);
		await sleep(500);

		// Step 5: Claude Code 起動
		const parts = [LAUNCHER, "--dangerously-skip-permissions"];
		if (sessionId) parts.push("--resume", sessionId);
		send(parts.join(" "));

		console.log(
			`[watchdog] Restarted Claude Code in ${sessionName}${sessionId ? ` (resume: ${sessionId})` : ""}`,
		);
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
