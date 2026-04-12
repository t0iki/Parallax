import http from "node:http";
import path from "node:path";
import * as pty from "node-pty";
import { WebSocketServer } from "ws";
import { handleDirectories } from "./routes/directories.js";
import { handleSessions } from "./routes/sessions.js";
import { handleTickets } from "./routes/tickets.js";
import { tmuxSessionExists } from "./services/tmux.js";
import { startWatchdog } from "./services/watchdog.js";

const PORT = 3001;
const SESSION_NAME = "plx-main";
const PROJECT_DIR = import.meta.dirname
	? path.join(import.meta.dirname, "..")
	: process.cwd();

// --- HTTP API ---

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

	if (await handleTickets(req, res, url)) return;
	if (await handleDirectories(req, res, url)) return;
	if (handleSessions(req, res, url, PROJECT_DIR)) return;

	res.writeHead(404);
	res.end("Not Found");
});

// --- WebSocket (PTY + tmux) ---

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

	const env: Record<string, string> = {
		...Object.fromEntries(
			Object.entries(process.env).filter(
				(entry): entry is [string, string] => entry[1] !== undefined,
			),
		),
		TERM: "xterm-256color",
	};
	const isNew = !tmuxSessionExists(sessionName);

	let ptyProcess: pty.IPty;
	let ptyAlive = true;
	const safeWrite = (data: string) => {
		if (!ptyAlive) return;
		try {
			ptyProcess.write(data);
		} catch {
			// PTY closed
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

		// Main session only: auto-launch Claude Code via launcher
		if (isNew && !sessionName.startsWith("plx-ticket-")) {
			const launcherPath = path.join(PROJECT_DIR, "bin", "launch-claude.sh");
			setTimeout(
				() => safeWrite(`${launcherPath} --dangerously-skip-permissions\n`),
				500,
			);
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
				// invalid resize message
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
	startWatchdog();
});
