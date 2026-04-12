import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function getHeadCommit(cwd: string, ref = "HEAD"): string | null {
	try {
		return execSync(`git rev-parse ${ref}`, { cwd }).toString().trim();
	} catch {
		return null;
	}
}

export function createWorktree(params: {
	repoPath: string;
	worktreeDir: string;
	branchName: string;
	baseBranch: string;
}): void {
	if (fs.existsSync(params.worktreeDir)) return;
	fs.mkdirSync(path.join(params.repoPath, ".plx-worktrees"), {
		recursive: true,
	});
	execSync(
		`git worktree add -b "${params.branchName}" "${params.worktreeDir}" "${params.baseBranch}"`,
		{ cwd: params.repoPath },
	);
}

export function removeWorktree(repoPath: string, worktreePath: string): void {
	try {
		execSync(`git worktree remove "${worktreePath}" --force`, {
			cwd: repoPath,
		});
	} catch {
		// already removed
	}
}

export function deleteBranch(repoPath: string, branchName: string): void {
	try {
		execSync(`git branch -D "${branchName}"`, { cwd: repoPath });
	} catch {
		// branch doesn't exist
	}
}

export function getDiffFiles(
	cwd: string,
	baseCommit: string,
): { status: string; path: string }[] {
	const output = execSync(`git diff ${baseCommit} --name-status`, { cwd })
		.toString()
		.trim();
	if (!output) return [];
	return output.split("\n").map((line) => {
		const [status, ...parts] = line.split("\t");
		return { status, path: parts.join("\t") };
	});
}

export function getFileDiff(
	cwd: string,
	baseCommit: string,
	filePath: string,
): string {
	return execSync(`git diff ${baseCommit} -- "${filePath}"`, {
		cwd,
	}).toString();
}

export function slugify(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^\w\s-]/g, "")
		.replace(/[\s_]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 60);
}
