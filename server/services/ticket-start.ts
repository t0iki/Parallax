import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import db from "../db.js";
import { createWorktree, getHeadCommit, slugify } from "./git.js";
import { tmuxSendKeys, tmuxSessionExists } from "./tmux.js";

const PLX_DIR = import.meta.dirname
	? path.join(import.meta.dirname, "..", "..")
	: process.cwd();

interface StartParams {
	ticketId: string;
	directoryId: string;
	addDirectoryIds?: string[];
}

interface StartResult {
	sessionName: string;
}

function getAddDirPaths(
	directoryId: string,
	addDirectoryIds?: string[],
): string[] {
	const paths: string[] = [];
	if (!addDirectoryIds?.length) return paths;
	for (const adId of addDirectoryIds) {
		if (adId === directoryId) continue;
		const ad = db
			.prepare("SELECT path FROM directories WHERE id = ?")
			.get(adId) as { path: string } | undefined;
		if (ad) paths.push(ad.path);
	}
	return paths;
}

function buildDescriptionFile(
	ticketId: string,
	ticket: { title: string; description: string },
): string {
	const descFile = path.join(os.tmpdir(), `plx-ticket-${ticketId}.md`);

	const subtasks = db
		.prepare(
			"SELECT id, title, description, status FROM tickets WHERE parent_id = ? ORDER BY created_at",
		)
		.all(ticketId) as {
		id: string;
		title: string;
		description: string;
		status: string;
	}[];

	const deps = db
		.prepare(
			`SELECT td.from_ticket_id, td.to_ticket_id, t1.title as from_title, t2.title as to_title
			 FROM ticket_dependencies td
			 JOIN tickets t1 ON td.from_ticket_id = t1.id
			 JOIN tickets t2 ON td.to_ticket_id = t2.id
			 WHERE td.from_ticket_id = ? OR td.to_ticket_id = ?`,
		)
		.all(ticketId, ticketId) as {
		from_ticket_id: string;
		to_ticket_id: string;
		from_title: string;
		to_title: string;
	}[];

	let subtaskSection = "";
	if (subtasks.length > 0) {
		subtaskSection =
			"\n\n## サブタスク\n\n以下のサブタスクを順番に実装してください:\n";
		for (const st of subtasks) {
			const check = st.status === "in_progress" ? "x" : " ";
			subtaskSection += `\n### [${check}] ${st.title}\n`;
			if (st.description) subtaskSection += `${st.description}\n`;
		}
	}

	let depSection = "";
	if (deps.length > 0) {
		depSection = "\n\n## 依存関係\n";
		for (const d of deps) {
			depSection += `- 「${d.from_title}」は「${d.to_title}」の完了後に実行\n`;
		}
	}

	const claudeMdPath = path.join(PLX_DIR, "CLAUDE.md");
	let rules = "";
	if (fs.existsSync(claudeMdPath)) {
		rules = `\n\n---\n# ルール\n${fs.readFileSync(claudeMdPath, "utf-8")}`;
	}

	fs.writeFileSync(
		descFile,
		`# ${ticket.title}\n\n${ticket.description}${subtaskSection}${depSection}${rules}`,
	);
	return descFile;
}

function buildMcpConfig(ticketId: string): string {
	const mcpConfigPath = path.join(os.tmpdir(), `plx-mcp-${ticketId}.json`);
	fs.writeFileSync(
		mcpConfigPath,
		JSON.stringify({
			mcpServers: {
				"plx-todo": {
					command: path.join(PLX_DIR, "server", "run-mcp.sh"),
					args: [],
				},
			},
		}),
	);
	return mcpConfigPath;
}

function updatePhase(ticketId: string, phase: string): void {
	db.prepare("UPDATE tickets SET start_phase = ? WHERE id = ?").run(
		phase,
		ticketId,
	);
}

export function startTicket(params: StartParams): StartResult | null {
	const { ticketId, directoryId, addDirectoryIds } = params;

	const ticket = db
		.prepare("SELECT id, title, description FROM tickets WHERE id = ?")
		.get(ticketId) as
		| { id: string; title: string; description: string }
		| undefined;
	if (!ticket) return null;

	const dir = db
		.prepare(
			"SELECT path, main_branch, branch_template FROM directories WHERE id = ?",
		)
		.get(directoryId) as
		| { path: string; main_branch: string; branch_template: string }
		| undefined;
	if (!dir) return null;

	const addDirPaths = getAddDirPaths(directoryId, addDirectoryIds);
	const sessionName = `plx-ticket-${ticketId}`;

	// Immediately update status
	db.prepare(
		"UPDATE tickets SET status = ?, start_phase = ?, work_directory_id = ? WHERE id = ?",
	).run("in_progress", "creating_worktree", directoryId, ticketId);

	// Background: worktree + Claude Code
	const descFile = buildDescriptionFile(ticketId, ticket);

	const branchName = (dir.branch_template || "{title}")
		.replace("{title}", slugify(ticket.title))
		.replace("{id}", ticketId.slice(0, 8));
	const worktreeDir = path.join(dir.path, ".plx-worktrees", ticketId);

	let worktreePath: string | null = null;
	const baseCommit = getHeadCommit(dir.path, dir.main_branch);

	try {
		createWorktree({
			repoPath: dir.path,
			worktreeDir,
			branchName,
			baseBranch: dir.main_branch,
		});
		worktreePath = worktreeDir;
	} catch (err) {
		console.error("Failed to create worktree:", err);
	}

	const effectiveCwd = worktreePath ?? dir.path;

	db.prepare(
		"UPDATE tickets SET base_commit = ?, worktree_path = ?, branch_name = ?, start_phase = ? WHERE id = ?",
	).run(baseCommit, worktreePath, branchName, "starting_claude", ticketId);

	if (!tmuxSessionExists(sessionName)) {
		const mcpConfigPath = buildMcpConfig(ticketId);
		const addDirFlags = addDirPaths.map((d) => `--add-dir "${d}"`).join(" ");
		const launcherPath = path.join(PLX_DIR, "bin", "launch-claude.sh");
		const claudeArgs =
			`--dangerously-skip-permissions --mcp-config "${mcpConfigPath}" ${addDirFlags}`.trim();

		try {
			execSync(`tmux new-session -d -s "${sessionName}" -c "${effectiveCwd}"`);
			tmuxSendKeys(sessionName, `${launcherPath} ${claudeArgs}`);
			updatePhase(ticketId, "sending_prompt");

			setTimeout(() => {
				if (fs.existsSync(descFile) && tmuxSessionExists(sessionName)) {
					try {
						tmuxSendKeys(
							sessionName,
							`${descFile} に記載されたタスクの内容を読み取り、実行してください。`,
						);
					} catch {
						// ignore
					}
				}
				updatePhase(ticketId, "running");
			}, 5000);
		} catch (err) {
			console.error("Failed to create tmux session:", err);
			updatePhase(ticketId, "error");
		}
	} else {
		updatePhase(ticketId, "running");
	}

	return { sessionName };
}
