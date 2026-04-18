import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";
import { useTheme } from "../lib/ThemeContext";

type TerminalProps = {
	sessionName?: string;
	cwd?: string;
	addDirs?: string[];
	label?: string;
};

export function Terminal({
	sessionName,
	cwd,
	addDirs,
	label = "Terminal",
}: TerminalProps) {
	const { theme } = useTheme();
	const containerRef = useRef<HTMLDivElement>(null);
	const addDirsKey = addDirs?.join(",") ?? "";

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const params = new URLSearchParams();
		if (sessionName) params.set("session", sessionName);
		if (cwd) params.set("cwd", cwd);
		if (addDirsKey) params.set("addDirs", addDirsKey);
		const query = params.toString();
		const wsUrl = `ws://${window.location.host}/ws${query ? `?${query}` : ""}`;

		const term = new XTerm({
			cursorBlink: true,
			fontSize: 13,
			fontFamily: '"Menlo", "DejaVu Sans Mono", "Consolas", monospace',
			allowProposedApi: true,
			// tmux/Claude Code がマウスを掴んでいても Option+ドラッグで選択できる
			macOptionClickForcesSelection: true,
			rightClickSelectsWord: true,
			theme: {
				background: "#1a1a2e",
				foreground: "#e0e0e0",
				cursor: "#e0e0e0",
				selectionBackground: "#3a3a5c",
			},
		});

		const fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		// Cmd/Ctrl+クリックでリンクを開く (tmux/Claudeのマウス捕獲下でも動作)
		term.loadAddon(
			new WebLinksAddon((event, uri) => {
				if (event.metaKey || event.ctrlKey) {
					window.open(uri, "_blank", "noopener,noreferrer");
				}
			}),
		);
		term.open(container);
		fitAddon.fit();

		// 選択テキストを自動でクリップボードにコピー
		term.onSelectionChange(() => {
			const sel = term.getSelection();
			if (sel) navigator.clipboard.writeText(sel);
		});

		const ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			const resizeMsg = `\x01${JSON.stringify({ cols: term.cols, rows: term.rows })}`;
			ws.send(resizeMsg);
		};

		ws.onmessage = (event) => {
			term.write(event.data);
		};

		ws.onclose = () => {
			term.write("\r\n[Connection closed]\r\n");
		};

		term.onData((data) => {
			ws.send(data);
		});

		const onResize = () => {
			fitAddon.fit();
			const resizeMsg = `\x01${JSON.stringify({ cols: term.cols, rows: term.rows })}`;
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(resizeMsg);
			}
		};

		const resizeObserver = new ResizeObserver(onResize);
		resizeObserver.observe(container);

		return () => {
			resizeObserver.disconnect();
			ws.close();
			term.dispose();
		};
	}, [sessionName, cwd, addDirsKey]);

	return (
		<div
			style={{
				height: "100%",
				display: "flex",
				flexDirection: "column",
				backgroundColor: theme.bg,
				padding: 12,
				boxSizing: "border-box",
				gap: 8,
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
				}}
			>
				<span
					style={{
						display: "inline-block",
						width: 8,
						height: 8,
						borderRadius: "50%",
						backgroundColor: theme.green,
					}}
				/>
				<span style={{ fontWeight: 600, fontSize: 14, color: theme.textLabel }}>
					{label}
				</span>
				<span
					style={{
						fontSize: 11,
						color: theme.textLabel,
						opacity: 0.6,
						marginLeft: 4,
					}}
				>
					Option+ドラッグで選択 / ⌘+クリックでリンクを開く
				</span>
			</div>
			<div
				style={{
					flex: 1,
					borderRadius: 8,
					overflow: "hidden",
					border: `1px solid ${theme.border}`,
				}}
			>
				<div
					ref={containerRef}
					style={{
						width: "100%",
						height: "100%",
						backgroundColor: "#1a1a2e",
					}}
				/>
			</div>
		</div>
	);
}
