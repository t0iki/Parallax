import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "../lib/ThemeContext";
import type { Ticket } from "../types/ticket";
import { DiffView } from "./DiffView";
import { Terminal } from "./Terminal";

type DetailTab = "overview" | "terminal" | "diff";

type Props = {
	ticket: Ticket;
	session: { sessionName: string; cwd: string; addDirPaths: string[] } | null;
	onClose: () => void;
	onUpdate: (
		id: string,
		fields: { title?: string; description?: string },
	) => void;
	onCreatePR: (ticketId: string) => void;
	onApply: (ticketId: string) => void;
	onRevert: (ticketId: string) => void;
	onStart: (ticketId: string) => void;
};

function DetailMenu({
	ticketId,
	hasSession,
	sessionCwd,
	onApply,
	onRevert,
	onCreatePR,
}: {
	ticketId: string;
	hasSession: boolean;
	sessionCwd: string | null;
	onApply: (id: string) => void;
	onRevert: (id: string) => void;
	onCreatePR: (id: string) => void;
}) {
	const { theme } = useTheme();
	const [open, setOpen] = useState(false);
	const btnRef = useRef<HTMLButtonElement>(null);
	const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

	useEffect(() => {
		if (open && btnRef.current) {
			const rect = btnRef.current.getBoundingClientRect();
			setPos({ top: rect.bottom + 4, left: rect.right - 160 });
		}
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const close = () => setOpen(false);
		document.addEventListener("click", close);
		return () => document.removeEventListener("click", close);
	}, [open]);

	const itemStyle: React.CSSProperties = {
		all: "unset",
		padding: "6px 10px",
		fontSize: 12,
		cursor: "pointer",
		borderRadius: 4,
		color: theme.text,
	};

	return (
		<>
			<button
				ref={btnRef}
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					setOpen(!open);
				}}
				style={{
					all: "unset",
					cursor: "pointer",
					padding: "4px 6px",
					fontSize: 16,
					color: theme.textMuted,
					lineHeight: 1,
				}}
			>
				⋯
			</button>
			{open && pos && (
				<div
					style={{
						position: "fixed",
						top: pos.top,
						left: pos.left,
						backgroundColor: theme.bgCard,
						border: `1px solid ${theme.border}`,
						borderRadius: 6,
						padding: 4,
						zIndex: 100,
						minWidth: 160,
						display: "flex",
						flexDirection: "column",
						boxShadow: `0 4px 12px ${theme.shadow}`,
					}}
				>
					<button
						type="button"
						onClick={() => {
							navigator.clipboard.writeText(
								`/tmp/plx/plx-ticket-${ticketId}.md`,
							);
							setOpen(false);
						}}
						style={itemStyle}
						onMouseEnter={(e) => {
							(e.target as HTMLElement).style.backgroundColor = theme.bgHover;
						}}
						onMouseLeave={(e) => {
							(e.target as HTMLElement).style.backgroundColor = "transparent";
						}}
					>
						プロンプトパスをコピー
					</button>
					{sessionCwd && (
						<button
							type="button"
							onClick={() => {
								fetch("/api/open-in-cursor", {
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({ path: sessionCwd }),
								});
								setOpen(false);
							}}
							style={itemStyle}
							onMouseEnter={(e) => {
								(e.target as HTMLElement).style.backgroundColor = theme.bgHover;
							}}
							onMouseLeave={(e) => {
								(e.target as HTMLElement).style.backgroundColor = "transparent";
							}}
						>
							Cursorで開く
						</button>
					)}
					{hasSession && (
						<>
							<button
								type="button"
								onClick={() => {
									onApply(ticketId);
									setOpen(false);
								}}
								style={{ ...itemStyle, color: theme.green }}
								onMouseEnter={(e) => {
									(e.target as HTMLElement).style.backgroundColor =
										theme.bgHover;
								}}
								onMouseLeave={(e) => {
									(e.target as HTMLElement).style.backgroundColor =
										"transparent";
								}}
							>
								反映
							</button>
							<button
								type="button"
								onClick={() => {
									onRevert(ticketId);
									setOpen(false);
								}}
								style={{ ...itemStyle, color: theme.yellow }}
								onMouseEnter={(e) => {
									(e.target as HTMLElement).style.backgroundColor =
										theme.bgHover;
								}}
								onMouseLeave={(e) => {
									(e.target as HTMLElement).style.backgroundColor =
										"transparent";
								}}
							>
								元に戻す
							</button>
							<button
								type="button"
								onClick={() => {
									onCreatePR(ticketId);
									setOpen(false);
								}}
								style={{ ...itemStyle, color: theme.accent }}
								onMouseEnter={(e) => {
									(e.target as HTMLElement).style.backgroundColor =
										theme.bgHover;
								}}
								onMouseLeave={(e) => {
									(e.target as HTMLElement).style.backgroundColor =
										"transparent";
								}}
							>
								PR作成
							</button>
						</>
					)}
				</div>
			)}
		</>
	);
}

function Overview({
	ticket,
	onUpdate,
}: {
	ticket: Ticket;
	onUpdate: (
		id: string,
		fields: { title?: string; description?: string },
	) => void;
}) {
	const { theme } = useTheme();
	const [title, setTitle] = useState(ticket.title);
	const [description, setDescription] = useState(ticket.description);
	const titleChanged = title !== ticket.title;
	const descChanged = description !== ticket.description;
	const dirty = titleChanged || descChanged;

	const [saved, setSaved] = useState(false);

	const save = () => {
		const fields: { title?: string; description?: string } = {};
		if (titleChanged) fields.title = title;
		if (descChanged) fields.description = description;
		if (dirty) {
			onUpdate(ticket.id, fields);
			setSaved(true);
			setTimeout(() => setSaved(false), 2000);
		}
	};

	return (
		<div
			style={{
				padding: 20,
				paddingBottom: 24,
				display: "flex",
				flexDirection: "column",
				gap: 16,
				height: "100%",
				overflow: "auto",
				boxSizing: "border-box",
			}}
		>
			<label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
				<span style={{ fontSize: 12, color: theme.textMuted }}>タイトル</span>
				<input
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					style={{
						padding: "8px 10px",
						fontSize: 14,
						backgroundColor: theme.bgInput,
						color: theme.text,
						border: `1px solid ${theme.border}`,
						borderRadius: 4,
					}}
				/>
			</label>
			<label
				style={{
					display: "flex",
					flexDirection: "column",
					gap: 6,
					flex: 1,
				}}
			>
				<span style={{ fontSize: 12, color: theme.textMuted }}>説明</span>
				<textarea
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					style={{
						flex: 1,
						minHeight: 120,
						padding: "8px 10px",
						fontSize: 13,
						fontFamily: "monospace",
						backgroundColor: theme.bgInput,
						color: theme.text,
						border: `1px solid ${theme.border}`,
						borderRadius: 4,
						resize: "vertical",
					}}
				/>
			</label>
			{ticket.sourceUrl && (
				<div>
					<span style={{ fontSize: 12, color: theme.textMuted }}>ソース: </span>
					<a
						href={ticket.sourceUrl}
						target="_blank"
						rel="noopener noreferrer"
						style={{ fontSize: 12, color: theme.link }}
					>
						{ticket.sourceUrl}
					</a>
				</div>
			)}
			<button
				type="button"
				onClick={save}
				disabled={!dirty}
				style={{
					padding: "8px 20px",
					fontSize: 13,
					backgroundColor: dirty ? theme.accent : theme.border,
					color: dirty ? "#fff" : theme.textDim,
					border: "none",
					borderRadius: 4,
					cursor: dirty ? "pointer" : "default",
					alignSelf: "flex-start",
					transition: "background-color 0.15s",
				}}
			>
				{saved ? "保存しました" : "保存"}
			</button>
		</div>
	);
}

export function TicketDetail({
	ticket,
	session,
	onClose,
	onUpdate,
	onCreatePR,
	onApply,
	onRevert,
	onStart,
}: Props) {
	const { theme } = useTheme();
	const [tab, setTab] = useState<DetailTab>("overview");
	const [widthPercent, setWidthPercent] = useState(60);
	const dragging = useRef(false);
	const panelRef = useRef<HTMLDivElement>(null);

	const hasDiff = !!ticket.baseCommit;

	// パネル外クリックで閉じる（モーダルが開いている場合は無視）
	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
				// z-index 100以上の要素（モーダル等）をクリックした場合は閉じない
				const target = e.target as HTMLElement;
				if (target.closest("[data-modal]")) return;
				onClose();
			}
		};
		// 次のtickで登録（開いたクリックで即閉じないように）
		const id = setTimeout(() => {
			document.addEventListener("mousedown", handleClick);
		}, 0);
		return () => {
			clearTimeout(id);
			document.removeEventListener("mousedown", handleClick);
		};
	}, [onClose]);

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		dragging.current = true;

		const onMouseMove = (ev: MouseEvent) => {
			if (!dragging.current) return;
			const percent =
				((window.innerWidth - ev.clientX) / window.innerWidth) * 100;
			setWidthPercent(Math.min(Math.max(percent, 20), 90));
		};

		const onMouseUp = () => {
			dragging.current = false;
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};

		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
	}, []);

	const tabStyle = (key: DetailTab, color: string): React.CSSProperties => ({
		padding: "6px 14px",
		fontSize: 12,
		border: "none",
		borderBottom: tab === key ? `2px solid ${color}` : "2px solid transparent",
		backgroundColor: "transparent",
		color: tab === key ? theme.text : theme.textDim,
		cursor: "pointer",
	});

	return (
		<div
			ref={panelRef}
			style={{
				position: "fixed",
				top: 0,
				right: 0,
				bottom: 0,
				width: `${widthPercent}%`,
				minWidth: 400,
				zIndex: 50,
				display: "flex",
				flexDirection: "row",
				backgroundColor: theme.bg,
				boxShadow: `-4px 0 24px ${theme.shadow}`,
			}}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: drag resize handle */}
			<div
				onMouseDown={handleMouseDown}
				style={{
					width: 6,
					cursor: "col-resize",
					backgroundColor: "transparent",
					flexShrink: 0,
					position: "relative",
				}}
			>
				<div
					style={{
						position: "absolute",
						left: 2,
						top: 0,
						bottom: 0,
						width: 1,
						backgroundColor: theme.border,
					}}
				/>
			</div>
			<div
				style={{
					flex: 1,
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						padding: "0 12px",
						borderBottom: `1px solid ${theme.border}`,
						flexShrink: 0,
						gap: 8,
					}}
				>
					<span
						style={{
							flex: 1,
							fontSize: 13,
							fontWeight: 600,
							color: theme.text,
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
							padding: "8px 0",
						}}
					>
						{ticket.title}
					</span>
					<DetailMenu
						ticketId={ticket.id}
						hasSession={!!session}
						sessionCwd={session?.cwd ?? ticket.worktreePath}
						onApply={onApply}
						onRevert={onRevert}
						onCreatePR={onCreatePR}
					/>
					<button
						type="button"
						onClick={onClose}
						style={{
							all: "unset",
							fontSize: 16,
							color: theme.textDim,
							cursor: "pointer",
							padding: "8px",
						}}
					>
						×
					</button>
				</div>
				<div
					style={{
						display: "flex",
						borderBottom: `1px solid ${theme.border}`,
						flexShrink: 0,
					}}
				>
					<button
						type="button"
						onClick={() => setTab("overview")}
						style={tabStyle("overview", theme.textLabel)}
					>
						概要
					</button>
					{session ? (
						<button
							type="button"
							onClick={() => setTab("terminal")}
							style={tabStyle("terminal", theme.green)}
						>
							Terminal
						</button>
					) : (
						ticket.status === "in_progress" && (
							<button
								type="button"
								onClick={() => onStart(ticket.id)}
								style={{
									padding: "6px 14px",
									fontSize: 16,
									border: "none",
									backgroundColor: "transparent",
									color: theme.green,
									cursor: "pointer",
								}}
							>
								+
							</button>
						)
					)}
					{hasDiff && (
						<button
							type="button"
							onClick={() => setTab("diff")}
							style={tabStyle("diff", theme.blue)}
						>
							Diff
						</button>
					)}
				</div>
				<div style={{ flex: 1, overflow: "hidden" }}>
					{tab === "overview" ? (
						<Overview ticket={ticket} onUpdate={onUpdate} />
					) : tab === "terminal" && session ? (
						<Terminal
							sessionName={session.sessionName}
							cwd={session.cwd}
							addDirs={session.addDirPaths}
							label={ticket.title}
						/>
					) : tab === "diff" && hasDiff ? (
						<DiffView ticketId={ticket.id} />
					) : (
						<div style={{ padding: 24, color: theme.textDim, fontSize: 13 }}>
							情報がありません
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
