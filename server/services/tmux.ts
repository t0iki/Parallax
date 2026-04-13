import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function tmuxSessionExists(sessionName: string): boolean {
	try {
		execSync(`tmux has-session -t ${sessionName} 2>/dev/null`);
		return true;
	} catch {
		return false;
	}
}

export function tmuxKillSession(sessionName: string): void {
	try {
		execSync(`tmux kill-session -t ${sessionName} 2>/dev/null`);
	} catch {
		// session doesn't exist
	}
}

export function tmuxSendKeys(sessionName: string, text: string): void {
	if (text.length > 200) {
		const tmpFile = path.join(os.tmpdir(), `plx-sendkeys-${Date.now()}.txt`);
		fs.writeFileSync(tmpFile, text);
		execSync(`tmux load-buffer "${tmpFile}"`);
		execSync(`tmux paste-buffer -t "${sessionName}"`);
		execSync(`tmux send-keys -t "${sessionName}" Enter`);
		fs.unlinkSync(tmpFile);
	} else {
		execSync(
			`tmux send-keys -t "${sessionName}" '${text.replace(/'/g, "'\\''")}' Enter`,
		);
	}
}

export function tmuxListTicketSessions(): string[] {
	try {
		const output = execSync(
			"tmux list-sessions -F '#{session_name}' 2>/dev/null",
		)
			.toString()
			.trim();
		return output.split("\n").filter((s) => s.startsWith("plx-ticket-"));
	} catch {
		return [];
	}
}
