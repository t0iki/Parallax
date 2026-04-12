import { execSync } from "node:child_process";
import path from "node:path";
import { tmuxListTicketSessions, tmuxSessionExists } from "./tmux.js";

const PLX_DIR = import.meta.dirname
	? path.join(import.meta.dirname, "..")
	: process.cwd();

function capturePaneOutput(sessionName: string): string {
	try {
		return execSync(
			`tmux capture-pane -t "${sessionName}" -p -S -5 2>/dev/null`,
		).toString();
	} catch {
		return "";
	}
}

function restartClaude(sessionName: string): void {
	const launcherPath = path.join(PLX_DIR, "bin", "launch-claude.sh");
	try {
		// Ctrl+C で現在のプロセスを止めてから再起動
		execSync(`tmux send-keys -t "${sessionName}" C-c 2>/dev/null`);
		setTimeout(() => {
			try {
				execSync(
					`tmux send-keys -t "${sessionName}" '${launcherPath} --dangerously-skip-permissions' Enter 2>/dev/null`,
				);
				console.log(`[watchdog] Restarted Claude Code in ${sessionName}`);
			} catch {
				// ignore
			}
		}, 1000);
	} catch {
		// ignore
	}
}

const ERROR_PATTERNS = [
	"Unable to connect to API",
	"ConnectionRefused",
	"unable to connect",
];

function checkSession(sessionName: string): void {
	const output = capturePaneOutput(sessionName);
	for (const pattern of ERROR_PATTERNS) {
		if (output.includes(pattern)) {
			console.log(
				`[watchdog] Detected "${pattern}" in ${sessionName}, restarting...`,
			);
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
		// メインセッション
		if (tmuxSessionExists("plx-main")) {
			checkSession("plx-main");
		}
		// チケットセッション
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
