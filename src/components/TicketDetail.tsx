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
};

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

	const save = () => {
		const fields: { title?: string; description?: string } = {};
		if (titleChanged) fields.title = title;
		if (descChanged) fields.description = description;
		if (dirty) onUpdate(ticket.id, fields);
	};

	return (
		<div
			style={{
				padding: 20,
				display: "flex",
				flexDirection: "column",
				gap: 16,
				height: "100%",
				overflow: "auto",
			}}
		>
			<label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
				<span style={{ fontSize: 12, color: theme.textMuted }}>タイトル</span>
				<input
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					onBlur={save}
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
					onBlur={save}
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
}: Props) {
	const { theme } = useTheme();
	const [tab, setTab] = useState<DetailTab>("overview");
	const [widthPercent, setWidthPercent] = useState(60);
	const dragging = useRef(false);
	const panelRef = useRef<HTMLDivElement>(null);

	const hasDiff = !!ticket.baseCommit;

	// パネル外クリックで閉じる
	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
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
					{session && (
						<>
							<button
								type="button"
								onClick={() => onApply(ticket.id)}
								style={{
									padding: "4px 10px",
									fontSize: 11,
									backgroundColor: "transparent",
									color: theme.green,
									border: `1px solid ${theme.greenBorder}`,
									borderRadius: 4,
									cursor: "pointer",
									whiteSpace: "nowrap",
								}}
							>
								反映
							</button>
							<button
								type="button"
								onClick={() => onRevert(ticket.id)}
								style={{
									padding: "4px 10px",
									fontSize: 11,
									backgroundColor: "transparent",
									color: theme.yellow,
									border: `1px solid ${theme.yellowBorder}`,
									borderRadius: 4,
									cursor: "pointer",
									whiteSpace: "nowrap",
								}}
							>
								元に戻す
							</button>
							<button
								type="button"
								onClick={() => onCreatePR(ticket.id)}
								style={{
									padding: "4px 10px",
									fontSize: 11,
									backgroundColor: theme.accent,
									color: "#fff",
									border: "none",
									borderRadius: 4,
									cursor: "pointer",
									whiteSpace: "nowrap",
								}}
							>
								PR作成
							</button>
						</>
					)}
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
					{session && (
						<button
							type="button"
							onClick={() => setTab("terminal")}
							style={tabStyle("terminal", theme.green)}
						>
							Terminal
						</button>
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
