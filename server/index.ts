import { execSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import * as pty from "node-pty";
import { WebSocketServer } from "ws";
import db from "./db.js";

const PORT = 3001;

// --- HTTP API ---

function readBody(req: http.IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let body = "";
		req.on("data", (chunk: Buffer) => {
			body += chunk.toString();
		});
		req.on("end", () => resolve(body));
		req.on("error", reject);
	});
}

function json(res: http.ServerResponse, status: number, data: unknown) {
	res.writeHead(status, { "Content-Type": "application/json" });
	res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader(
		"Access-Control-Allow-Methods",
		"GET, POST, PUT, PATCH, DELETE, OPTIONS",
	);
	res.setHeader("Access-Control-Allow-Headers", "Content-Type");

	if (req.method === "OPTIONS") {
		res.writeHead(204);
		res.end();
		return;
	}

	const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

	// GET /api/tickets
	if (req.method === "GET" && url.pathname === "/api/tickets") {
		const rows = db
			.prepare(
				`SELECT id, title, description, source_url as sourceUrl,
				        parent_id as parentId, status, base_commit as baseCommit,
				        work_directory_id as workDirectoryId, worktree_path as worktreePath,
				        start_phase as startPhase, created_at as createdAt
				 FROM tickets ORDER BY created_at`,
			)
			.all() as Record<string, unknown>[];
		const tdRows = db
			.prepare("SELECT ticket_id, directory_id FROM ticket_directories")
			.all() as { ticket_id: string; directory_id: string }[];
		const dirMap = new Map<string, string[]>();
		for (const r of tdRows) {
			const list = dirMap.get(r.ticket_id) ?? [];
			list.push(r.directory_id);
			dirMap.set(r.ticket_id, list);
		}
		const result = rows.map((row) => ({
			...row,
			directoryIds: dirMap.get(row.id as string) ?? [],
		}));
		json(res, 200, result);
		return;
	}

	// POST /api/tickets
	if (req.method === "POST" && url.pathname === "/api/tickets") {
		const body = JSON.parse(await readBody(req));
		db.prepare(
			`INSERT INTO tickets (id, title, description, source_url, parent_id, status, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		).run(
			body.id,
			body.title,
			body.description ?? "",
			body.sourceUrl ?? null,
			body.parentId ?? null,
			body.status,
			body.createdAt,
		);
		json(res, 201, body);
		return;
	}

	// GET /api/tickets/dependencies
	if (req.method === "GET" && url.pathname === "/api/tickets/dependencies") {
		const rows = db
			.prepare(
				`SELECT id, from_ticket_id as fromTicketId, to_ticket_id as toTicketId,
				        created_at as createdAt
				 FROM ticket_dependencies ORDER BY created_at`,
			)
			.all();
		json(res, 200, rows);
		return;
	}

	// POST /api/tickets/dependencies
	if (req.method === "POST" && url.pathname === "/api/tickets/dependencies") {
		const body = JSON.parse(await readBody(req));
		// 循環依存チェック
		const cycle = db
			.prepare(
				`WITH RECURSIVE chain(tid) AS (
				   SELECT ?
				   UNION
				   SELECT d.from_ticket_id FROM ticket_dependencies d
				   JOIN chain c ON d.to_ticket_id = c.tid
				 )
				 SELECT 1 FROM chain WHERE tid = ?`,
			)
			.get(body.fromTicketId, body.toTicketId);
		if (cycle) {
			json(res, 400, { error: "Circular dependency detected" });
			return;
		}
		db.prepare(
			`INSERT INTO ticket_dependencies (id, from_ticket_id, to_ticket_id, created_at)
			 VALUES (?, ?, ?, ?)`,
		).run(body.id, body.fromTicketId, body.toTicketId, body.createdAt);
		json(res, 201, body);
		return;
	}

	// DELETE /api/tickets/dependencies/:id
	const depDeleteMatch = url.pathname.match(
		/^\/api\/tickets\/dependencies\/(.+)$/,
	);
	if (req.method === "DELETE" && depDeleteMatch) {
		const id = depDeleteMatch[1];
		db.prepare("DELETE FROM ticket_dependencies WHERE id = ?").run(id);
		json(res, 200, { id });
		return;
	}

	// PATCH /api/tickets/:id
	const patchMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)$/);
	if (req.method === "PATCH" && patchMatch) {
		const id = patchMatch[1];
		const body = JSON.parse(await readBody(req));
		const fields: string[] = [];
		const values: unknown[] = [];
		if (body.status !== undefined) {
			fields.push("status = ?");
			values.push(body.status);
		}
		if (body.title !== undefined) {
			fields.push("title = ?");
			values.push(body.title);
		}
		if (body.description !== undefined) {
			fields.push("description = ?");
			values.push(body.description);
		}
		if (fields.length > 0) {
			values.push(id);
			db.prepare(`UPDATE tickets SET ${fields.join(", ")} WHERE id = ?`).run(
				...values,
			);
		}
		json(res, 200, { id, ...body });
		return;
	}

	// DELETE /api/tickets/:id
	const deleteMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)$/);
	if (req.method === "DELETE" && deleteMatch) {
		const id = deleteMatch[1];

		// worktree・ブランチ・tmuxセッションをクリーンアップ
		const ticketInfo = db
			.prepare(
				"SELECT worktree_path, work_directory_id, branch_name FROM tickets WHERE id = ?",
			)
			.get(id) as
			| {
					worktree_path: string | null;
					work_directory_id: string | null;
					branch_name: string | null;
			  }
			| undefined;

		// tmuxセッションを終了
		try {
			execSync(`tmux kill-session -t zanki-ticket-${id} 2>/dev/null`);
		} catch {
			// セッションが存在しない場合は無視
		}

		if (ticketInfo?.worktree_path && ticketInfo.work_directory_id) {
			const dir = db
				.prepare("SELECT path FROM directories WHERE id = ?")
				.get(ticketInfo.work_directory_id) as { path: string } | undefined;
			if (dir) {
				try {
					execSync(
						`git worktree remove "${ticketInfo.worktree_path}" --force`,
						{ cwd: dir.path },
					);
					console.log(
						`[cleanup] Removed worktree: ${ticketInfo.worktree_path}`,
					);
				} catch (err) {
					console.log(`[cleanup] Worktree remove failed: ${err}`);
				}
				if (ticketInfo.branch_name) {
					try {
						execSync(`git branch -D "${ticketInfo.branch_name}"`, {
							cwd: dir.path,
						});
						console.log(`[cleanup] Removed branch: ${ticketInfo.branch_name}`);
					} catch (err) {
						console.log(`[cleanup] Branch delete failed: ${err}`);
					}
				}
			}
		}

		db.prepare("DELETE FROM tickets WHERE id = ?").run(id);
		json(res, 200, { id });
		return;
	}

	// GET /api/directories
	if (req.method === "GET" && url.pathname === "/api/directories") {
		const rows = db
			.prepare(
				"SELECT id, name, path, main_branch as mainBranch, branch_template as branchTemplate, created_at as createdAt FROM directories ORDER BY created_at",
			)
			.all();
		json(res, 200, rows);
		return;
	}

	// POST /api/directories
	if (req.method === "POST" && url.pathname === "/api/directories") {
		const body = JSON.parse(await readBody(req));
		db.prepare(
			"INSERT INTO directories (id, name, path, main_branch, branch_template, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		).run(
			body.id,
			body.name,
			body.path,
			body.mainBranch ?? "main",
			body.branchTemplate ?? "{title}",
			body.createdAt,
		);
		json(res, 201, body);
		return;
	}

	// PATCH /api/directories/:id
	const dirPatchMatch = url.pathname.match(/^\/api\/directories\/([^/]+)$/);
	if (req.method === "PATCH" && dirPatchMatch) {
		const id = dirPatchMatch[1];
		const body = JSON.parse(await readBody(req));
		const fields: string[] = [];
		const values: unknown[] = [];
		if (body.name !== undefined) {
			fields.push("name = ?");
			values.push(body.name);
		}
		if (body.path !== undefined) {
			fields.push("path = ?");
			values.push(body.path);
		}
		if (body.mainBranch !== undefined) {
			fields.push("main_branch = ?");
			values.push(body.mainBranch);
		}
		if (body.branchTemplate !== undefined) {
			fields.push("branch_template = ?");
			values.push(body.branchTemplate);
		}
		if (fields.length > 0) {
			values.push(id);
			db.prepare(
				`UPDATE directories SET ${fields.join(", ")} WHERE id = ?`,
			).run(...values);
		}
		json(res, 200, { id, ...body });
		return;
	}

	// DELETE /api/directories/:id
	const dirDeleteMatch = url.pathname.match(/^\/api\/directories\/([^/]+)$/);
	if (req.method === "DELETE" && dirDeleteMatch) {
		const id = dirDeleteMatch[1];
		db.prepare("DELETE FROM directories WHERE id = ?").run(id);
		json(res, 200, { id });
		return;
	}

	// POST /api/tickets/:id/start — チケット作業開始
	const startMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)\/start$/);
	if (req.method === "POST" && startMatch) {
		const ticketId = startMatch[1];
		const body = JSON.parse(await readBody(req));
		const { directoryId, addDirectoryIds } = body as {
			directoryId: string;
			addDirectoryIds?: string[];
		};

		const ticket = db
			.prepare("SELECT id, title, description FROM tickets WHERE id = ?")
			.get(ticketId) as
			| { id: string; title: string; description: string }
			| undefined;
		if (!ticket) {
			json(res, 404, { error: "Ticket not found" });
			return;
		}

		const dir = db
			.prepare(
				"SELECT path, main_branch, branch_template FROM directories WHERE id = ?",
			)
			.get(directoryId) as
			| { path: string; main_branch: string; branch_template: string }
			| undefined;
		if (!dir) {
			json(res, 404, { error: "Directory not found" });
			return;
		}

		// 追加ディレクトリのパスを取得
		const addDirPaths: string[] = [];
		if (addDirectoryIds && addDirectoryIds.length > 0) {
			for (const adId of addDirectoryIds) {
				if (adId === directoryId) continue;
				const ad = db
					.prepare("SELECT path FROM directories WHERE id = ?")
					.get(adId) as { path: string } | undefined;
				if (ad) addDirPaths.push(ad.path);
			}
		}

		const sessionName = `zanki-ticket-${ticketId}`;

		// 即座にステータスを更新してレスポンスを返す
		db.prepare(
			"UPDATE tickets SET status = ?, start_phase = ?, work_directory_id = ? WHERE id = ?",
		).run("in_progress", "creating_worktree", directoryId, ticketId);

		json(res, 200, { sessionName });

		// --- 以降はバックグラウンドで実行 ---

		// descriptionをテンポラリファイルに書き出し（サブタスク・依存関係・ルールも含める）
		const descFile = path.join(os.tmpdir(), `zanki-ticket-${ticketId}.md`);
		const zankiDir = import.meta.dirname
			? path.join(import.meta.dirname, "..")
			: process.cwd();

		// サブタスクを取得
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

		// 依存関係を取得
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
				const check = st.status === "done" ? "x" : " ";
				subtaskSection += `\n### [${check}] ${st.title}\n`;
				if (st.description) {
					subtaskSection += `${st.description}\n`;
				}
			}
		}

		let depSection = "";
		if (deps.length > 0) {
			depSection = "\n\n## 依存関係\n";
			for (const d of deps) {
				depSection += `- 「${d.from_title}」は「${d.to_title}」の完了後に実行\n`;
			}
		}

		const claudeMdPath = path.join(zankiDir, "CLAUDE.md");
		let rules = "";
		if (fs.existsSync(claudeMdPath)) {
			rules = `\n\n---\n# ルール\n${fs.readFileSync(claudeMdPath, "utf-8")}`;
		}

		const descContent = `# ${ticket.title}\n\n${ticket.description}${subtaskSection}${depSection}${rules}`;
		fs.writeFileSync(descFile, descContent);

		// ブランチ名をテンプレートから生成
		const slugify = (s: string) =>
			s
				.toLowerCase()
				.replace(/[^\w\s-]/g, "")
				.replace(/[\s_]+/g, "-")
				.replace(/-+/g, "-")
				.replace(/^-|-$/g, "")
				.slice(0, 60);
		const branchName = (dir.branch_template || "{title}")
			.replace("{title}", slugify(ticket.title))
			.replace("{id}", ticketId.slice(0, 8));
		const worktreeDir = path.join(dir.path, ".zanki-worktrees", ticketId);
		let worktreePath: string | null = null;
		let baseCommit: string | null = null;

		try {
			baseCommit = execSync(`git rev-parse ${dir.main_branch}`, {
				cwd: dir.path,
			})
				.toString()
				.trim();

			if (!fs.existsSync(worktreeDir)) {
				fs.mkdirSync(path.join(dir.path, ".zanki-worktrees"), {
					recursive: true,
				});
				execSync(
					`git worktree add -b "${branchName}" "${worktreeDir}" "${dir.main_branch}"`,
					{ cwd: dir.path },
				);
			}
			worktreePath = worktreeDir;
		} catch (err) {
			console.error("Failed to create worktree:", err);
		}

		const effectiveCwd = worktreePath ?? dir.path;

		db.prepare(
			`UPDATE tickets SET base_commit = ?, worktree_path = ?, branch_name = ?, start_phase = ? WHERE id = ?`,
		).run(baseCommit, worktreePath, branchName, "starting_claude", ticketId);

		// tmuxセッション作成 + Claude Code起動
		if (!tmuxSessionExists(sessionName)) {
			const addDirFlags = addDirPaths.map((d) => `--add-dir "${d}"`).join(" ");

			// 絶対パスのMCP設定ファイルを生成
			const zankiDir = import.meta.dirname
				? path.join(import.meta.dirname, "..")
				: process.cwd();
			const mcpConfigPath = path.join(
				os.tmpdir(),
				`zanki-mcp-${ticketId}.json`,
			);
			const mcpConfig = {
				mcpServers: {
					"zanki-todo": {
						command: path.join(zankiDir, "server", "run-mcp.sh"),
						args: [],
					},
				},
			};
			fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig));

			const claudeCmd =
				`claude --dangerously-skip-permissions --mcp-config "${mcpConfigPath}" ${addDirFlags}`.trim();

			try {
				// ログインシェルでセッションを作成
				execSync(
					`tmux new-session -d -s "${sessionName}" -c "${effectiveCwd}" /bin/zsh -l`,
				);
				execSync(
					`tmux send-keys -t "${sessionName}" '${claudeCmd.replace(/'/g, "'\\''")}' Enter`,
				);

				db.prepare("UPDATE tickets SET start_phase = ? WHERE id = ?").run(
					"sending_prompt",
					ticketId,
				);

				setTimeout(() => {
					if (fs.existsSync(descFile) && tmuxSessionExists(sessionName)) {
						const prompt = `${descFile} に記載されたタスクの内容を読み取り、実行してください。`;
						try {
							execSync(
								`tmux send-keys -t "${sessionName}" '${prompt.replace(/'/g, "'\\''")}' Enter`,
							);
						} catch {
							// ignore
						}
					}
					db.prepare("UPDATE tickets SET start_phase = ? WHERE id = ?").run(
						"running",
						ticketId,
					);
				}, 5000);
			} catch (err) {
				console.error("Failed to create tmux session:", err);
				db.prepare("UPDATE tickets SET start_phase = ? WHERE id = ?").run(
					"error",
					ticketId,
				);
			}
		} else {
			db.prepare("UPDATE tickets SET start_phase = ? WHERE id = ?").run(
				"running",
				ticketId,
			);
		}
		return;
	}

	// POST /api/tickets/:id/send-keys — チケットのtmuxセッションにキーを送信
	const sendKeysMatch = url.pathname.match(
		/^\/api\/tickets\/([^/]+)\/send-keys$/,
	);
	if (req.method === "POST" && sendKeysMatch) {
		const ticketId = sendKeysMatch[1];
		const body = JSON.parse(await readBody(req));
		const text: string = body.text ?? "";
		const sessionName = `zanki-ticket-${ticketId}`;

		if (!tmuxSessionExists(sessionName)) {
			json(res, 400, { error: "Session not found" });
			return;
		}

		try {
			execSync(
				`tmux send-keys -t "${sessionName}" '${text.replace(/'/g, "'\\''")}' Enter`,
			);
			json(res, 200, { ok: true });
		} catch (err) {
			json(res, 500, {
				error: `send-keys failed: ${err instanceof Error ? err.message : String(err)}`,
			});
		}
		return;
	}

	// GET /api/tickets/:id/diff — 変更ファイル一覧
	const diffListMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)\/diff$/);
	if (req.method === "GET" && diffListMatch) {
		const ticketId = diffListMatch[1];
		const ticket = db
			.prepare(
				"SELECT base_commit, worktree_path, work_directory_id FROM tickets WHERE id = ?",
			)
			.get(ticketId) as
			| {
					base_commit: string | null;
					worktree_path: string | null;
					work_directory_id: string | null;
			  }
			| undefined;
		if (!ticket?.base_commit) {
			json(res, 400, { error: "No base commit recorded" });
			return;
		}
		// worktree_path があればそれを使う、なければ元ディレクトリ
		let diffCwd: string | null = ticket.worktree_path;
		if (!diffCwd && ticket.work_directory_id) {
			const dir = db
				.prepare("SELECT path FROM directories WHERE id = ?")
				.get(ticket.work_directory_id) as { path: string } | undefined;
			diffCwd = dir?.path ?? null;
		}
		if (!diffCwd) {
			json(res, 400, { error: "No working directory" });
			return;
		}
		try {
			const output = execSync(`git diff ${ticket.base_commit} --name-status`, {
				cwd: diffCwd,
			})
				.toString()
				.trim();
			const files = output
				? output.split("\n").map((line) => {
						const [status, ...parts] = line.split("\t");
						return { status, path: parts.join("\t") };
					})
				: [];
			json(res, 200, { baseCommit: ticket.base_commit, files });
		} catch (err) {
			json(res, 500, {
				error: `git diff failed: ${err instanceof Error ? err.message : String(err)}`,
			});
		}
		return;
	}

	// GET /api/tickets/:id/diff/:filePath — 特定ファイルのunified diff
	const diffFileMatch = url.pathname.match(
		/^\/api\/tickets\/([^/]+)\/diff\/(.+)$/,
	);
	if (req.method === "GET" && diffFileMatch) {
		const ticketId = diffFileMatch[1];
		const filePath = decodeURIComponent(diffFileMatch[2]);
		const ticket = db
			.prepare(
				"SELECT base_commit, worktree_path, work_directory_id FROM tickets WHERE id = ?",
			)
			.get(ticketId) as
			| {
					base_commit: string | null;
					worktree_path: string | null;
					work_directory_id: string | null;
			  }
			| undefined;
		if (!ticket?.base_commit) {
			json(res, 400, { error: "No base commit recorded" });
			return;
		}
		let diffCwd: string | null = ticket.worktree_path;
		if (!diffCwd && ticket.work_directory_id) {
			const dir = db
				.prepare("SELECT path FROM directories WHERE id = ?")
				.get(ticket.work_directory_id) as { path: string } | undefined;
			diffCwd = dir?.path ?? null;
		}
		if (!diffCwd) {
			json(res, 400, { error: "No working directory" });
			return;
		}
		// ディレクトリトラバーサル対策
		const resolved = path.resolve(diffCwd, filePath);
		if (!resolved.startsWith(path.resolve(diffCwd))) {
			json(res, 400, { error: "Invalid file path" });
			return;
		}
		try {
			const output = execSync(
				`git diff ${ticket.base_commit} -- "${filePath}"`,
				{ cwd: diffCwd },
			).toString();
			res.writeHead(200, { "Content-Type": "text/plain" });
			res.end(output);
		} catch (err) {
			json(res, 500, {
				error: `git diff failed: ${err instanceof Error ? err.message : String(err)}`,
			});
		}
		return;
	}

	// GET /api/sessions — アクティブなチケットセッション一覧
	if (req.method === "GET" && url.pathname === "/api/sessions") {
		try {
			const output = execSync(
				"tmux list-sessions -F '#{session_name}' 2>/dev/null",
			)
				.toString()
				.trim();
			const sessions = output
				.split("\n")
				.filter((s) => s.startsWith("zanki-ticket-"))
				.map((sessionName) => {
					const ticketId = sessionName.replace("zanki-ticket-", "");
					// チケット情報とディレクトリ情報を取得
					const ticket = db
						.prepare("SELECT id, title FROM tickets WHERE id = ?")
						.get(ticketId) as { id: string; title: string } | undefined;
					// tmuxセッションのcwdを取得
					let cwd = PROJECT_DIR;
					try {
						cwd = execSync(
							`tmux display-message -t ${sessionName} -p '#{pane_current_path}' 2>/dev/null`,
						)
							.toString()
							.trim();
					} catch {
						// ignore
					}
					return {
						ticketId,
						sessionName,
						cwd,
						title: ticket?.title ?? ticketId,
					};
				});
			json(res, 200, sessions);
		} catch {
			// tmuxが起動していない場合
			json(res, 200, []);
		}
		return;
	}

	res.writeHead(404);
	res.end("Not Found");
});

// --- WebSocket (PTY + tmux) ---

const SESSION_NAME = "zanki-main";
const PROJECT_DIR = import.meta.dirname
	? path.join(import.meta.dirname, "..")
	: process.cwd();

function buildPtyEnv(): Record<string, string> {
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value !== undefined) {
			env[key] = value;
		}
	}
	env.TERM = "xterm-256color";
	return env;
}

function tmuxSessionExists(sessionName: string): boolean {
	try {
		execSync(`tmux has-session -t ${sessionName} 2>/dev/null`);
		return true;
	} catch {
		return false;
	}
}

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
	const reqUrl = new URL(req.url ?? "/", `http://localhost:${PORT}`);
	if (reqUrl.pathname === "/ws") {
		wss.handleUpgrade(req, socket, head, (ws) => {
			wss.emit("connection", ws, req);
		});
	} else {
		socket.destroy();
	}
});

wss.on("connection", (ws, req: http.IncomingMessage) => {
	const reqUrl = new URL(req.url ?? "/", `http://localhost:${PORT}`);
	const sessionName = reqUrl.searchParams.get("session") ?? SESSION_NAME;
	const cwd = reqUrl.searchParams.get("cwd") ?? PROJECT_DIR;

	console.log(`Client connected: session=${sessionName}`);

	const env = buildPtyEnv();
	const isNew = !tmuxSessionExists(sessionName);

	let ptyProcess: pty.IPty;
	let ptyAlive = true;
	const safeWrite = (data: string) => {
		if (!ptyAlive) return;
		try {
			ptyProcess.write(data);
		} catch {
			// PTYが既に終了している場合は無視
		}
	};

	try {
		ptyProcess = pty.spawn("tmux", ["new-session", "-A", "-s", sessionName], {
			name: "xterm-256color",
			cols: 80,
			rows: 24,
			cwd,
			env,
		});

		// メインセッション（zanki-main）のみ: 新規作成時にClaude Codeを自動起動
		// チケットセッションはPOST /api/tickets/:id/start でtmux send-keysで起動済み
		if (isNew && !sessionName.startsWith("zanki-ticket-")) {
			const claudeCmd = "claude --dangerously-skip-permissions";
			setTimeout(() => safeWrite(`${claudeCmd}\n`), 500);
		}

		console.log(
			`PTY spawned (tmux ${isNew ? "new" : "attach"}): session=${sessionName}, pid=${ptyProcess.pid}`,
		);
	} catch (err) {
		console.error("Failed to spawn PTY:", err);
		ws.close();
		return;
	}

	ptyProcess.onData((data) => {
		try {
			ws.send(data);
		} catch {
			// client disconnected
		}
	});

	ptyProcess.onExit(({ exitCode, signal }) => {
		ptyAlive = false;
		console.log(
			`PTY exited: session=${sessionName}, code=${exitCode}, signal=${signal}`,
		);
		ws.close();
	});

	ws.on("message", (msg) => {
		const message = msg.toString();

		if (message.startsWith("\x01")) {
			try {
				const { cols, rows } = JSON.parse(message.slice(1));
				if (ptyAlive) ptyProcess.resize(cols, rows);
			} catch {
				// invalid resize message or PTY closed
			}
			return;
		}

		safeWrite(message);
	});

	ws.on("close", () => {
		console.log(`Client disconnected: session=${sessionName} (preserved)`);
		ptyProcess.kill();
	});
});

wss.on("error", (err) => {
	console.error("WebSocket server error:", err);
});

server.listen(PORT, () => {
	console.log(`Server listening on http://localhost:${PORT}`);
});
