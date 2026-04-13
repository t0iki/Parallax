import { useEffect, useRef, useState } from "react";
import { useTheme } from "../lib/ThemeContext";
import type { Directory } from "../types/directory";
import {
	STATUS_LABELS,
	STATUSES,
	type Status,
	type Ticket,
	type TicketDependency,
} from "../types/ticket";

type Props = {
	tickets: Ticket[];
	dependencies: TicketDependency[];
	directories: Directory[];
	onAdd: (title: string, status: Status) => void;
	onChangeStatus: (id: string, status: Status) => void;
	onDelete: (id: string) => void;
	onStart: (ticketId: string) => void;
	onDecompose: (ticketId: string) => void;
	onResetToTodo: (ticketId: string) => void;
	onTicketClick: (ticketId: string) => void;
	selectedTicketId: string | null;
	sessionStatuses: Map<
		string,
		{ sessionName: string; cwd: string; status: "idle" | "working" | "error" }
	>;
};

const menuItemStyle: React.CSSProperties = {
	all: "unset",
	padding: "6px 10px",
	fontSize: 12,
	cursor: "pointer",
	borderRadius: 4,
};

function TicketMenu({
	menuOpen,
	ticketId,
	isInProgress,
	onToggleMenu,
	onDecompose,
	onResetToTodo,
	onDelete,
}: {
	menuOpen: boolean;
	ticketId: string;
	isInProgress: boolean;
	onToggleMenu: (id: string) => void;
	onDecompose: (id: string) => void;
	onResetToTodo: (id: string) => void;
	onDelete: (id: string) => void;
}) {
	const { theme } = useTheme();
	const btnRef = useRef<HTMLButtonElement>(null);
	const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

	useEffect(() => {
		if (menuOpen && btnRef.current) {
			const rect = btnRef.current.getBoundingClientRect();
			const menuHeight = 70;
			const spaceBelow = window.innerHeight - rect.bottom;
			setPos({
				top: spaceBelow < menuHeight ? rect.top - menuHeight : rect.bottom + 4,
				left: rect.right - 120,
			});
		}
	}, [menuOpen]);

	return (
		<>
			<button
				ref={btnRef}
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onToggleMenu(ticketId);
				}}
				style={{
					all: "unset",
					cursor: "pointer",
					padding: "2px 4px",
					fontSize: 14,
					color: theme.textDim,
					lineHeight: 1,
				}}
			>
				⋯
			</button>
			{menuOpen && pos && (
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
						minWidth: 120,
						display: "flex",
						flexDirection: "column",
						boxShadow: `0 4px 12px ${theme.shadow}`,
					}}
				>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onToggleMenu("");
							onDecompose(ticketId);
						}}
						style={{ ...menuItemStyle, color: theme.blue }}
						onMouseEnter={(e) => {
							(e.target as HTMLElement).style.backgroundColor = theme.bgHover;
						}}
						onMouseLeave={(e) => {
							(e.target as HTMLElement).style.backgroundColor = "transparent";
						}}
					>
						タスク分解
					</button>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onToggleMenu("");
							const p = `/tmp/plx/plx-ticket-${ticketId}.md`;
							navigator.clipboard.writeText(p);
						}}
						style={{ ...menuItemStyle, color: theme.textLabel }}
						onMouseEnter={(e) => {
							(e.target as HTMLElement).style.backgroundColor = theme.bgHover;
						}}
						onMouseLeave={(e) => {
							(e.target as HTMLElement).style.backgroundColor = "transparent";
						}}
					>
						プロンプトパスをコピー
					</button>
					{isInProgress && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onToggleMenu("");
								onResetToTodo(ticketId);
							}}
							style={{ ...menuItemStyle, color: theme.yellow }}
							onMouseEnter={(e) => {
								(e.target as HTMLElement).style.backgroundColor = theme.bgHover;
							}}
							onMouseLeave={(e) => {
								(e.target as HTMLElement).style.backgroundColor = "transparent";
							}}
						>
							TODOに戻す
						</button>
					)}
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onToggleMenu("");
							onDelete(ticketId);
						}}
						style={{ ...menuItemStyle, color: theme.red }}
						onMouseEnter={(e) => {
							(e.target as HTMLElement).style.backgroundColor = theme.bgHover;
						}}
						onMouseLeave={(e) => {
							(e.target as HTMLElement).style.backgroundColor = "transparent";
						}}
					>
						削除
					</button>
				</div>
			)}
		</>
	);
}

function TicketCard({
	ticket,
	childCount,
	blockedByNames,
	isSelected,
	directoryName,
	sessionStatus,
	menuOpen,
	onDelete,
	hasChildren,
	childrenExpanded,
	onToggleChildren,
	onStart,
	onDecompose,
	onResetToTodo,
	onToggleMenu,
	onClick,
}: {
	ticket: Ticket;
	childCount: number;
	blockedByNames: string[];
	isSelected: boolean;
	directoryName: string | null;
	sessionStatus: "idle" | "working" | "error" | null;
	hasChildren: boolean;
	childrenExpanded: boolean;
	onToggleChildren: () => void;
	menuOpen: boolean;
	onDelete: (id: string) => void;
	onStart: (ticketId: string) => void;
	onDecompose: (ticketId: string) => void;
	onResetToTodo: (ticketId: string) => void;
	onToggleMenu: (ticketId: string) => void;
	onClick: () => void;
}) {
	const { theme } = useTheme();
	return (
		<li
			draggable
			onDragStart={(e) => e.dataTransfer.setData("ticket-id", ticket.id)}
			onClick={onClick}
			onKeyDown={(e) => e.key === "Enter" && onClick()}
			style={{
				padding: "10px 12px",
				backgroundColor: isSelected ? theme.bgHover : theme.bgCard,
				borderRadius: 6,
				border: isSelected
					? `1px solid ${theme.borderActive}`
					: `1px solid ${theme.border}`,
				boxShadow: `0 1px 3px ${theme.shadow}`,
				cursor: "grab",
				display: "flex",
				flexDirection: "column",
				gap: 6,
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 8,
				}}
			>
				{hasChildren && (
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onToggleChildren();
						}}
						style={{
							all: "unset",
							cursor: "pointer",
							fontSize: 10,
							color: theme.textMuted,
							flexShrink: 0,
							width: 14,
							textAlign: "center",
							transition: "transform 0.15s",
							transform: childrenExpanded ? "rotate(90deg)" : "rotate(0deg)",
						}}
					>
						▶
					</button>
				)}
				{sessionStatus === "idle" && (
					<span
						title="停止中"
						style={{
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							width: 18,
							height: 18,
							borderRadius: "50%",
							backgroundColor: theme.red,
							color: "#fff",
							fontSize: 11,
							fontWeight: 700,
							flexShrink: 0,
							lineHeight: 1,
						}}
					>
						!
					</span>
				)}
				{sessionStatus === "error" && (
					<span title="エラー" style={{ fontSize: 12, flexShrink: 0 }}>
						⚠️
					</span>
				)}
				<span
					style={{
						fontSize: 14,
						wordBreak: "break-word",
						color: theme.text,
						flex: 1,
					}}
				>
					{ticket.title}
				</span>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 6,
						flexShrink: 0,
					}}
				>
					{ticket.status === "todo" && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onStart(ticket.id);
							}}
							style={{
								padding: "2px 6px",
								fontSize: 11,
								backgroundColor: "transparent",
								color: theme.green,
								border: `1px solid ${theme.greenBorder}`,
								borderRadius: 4,
								cursor: "pointer",
							}}
						>
							▶
						</button>
					)}
					{ticket.sourceUrl && (
						<a
							href={ticket.sourceUrl}
							target="_blank"
							rel="noopener noreferrer"
							onClick={(e) => e.stopPropagation()}
							style={{
								fontSize: 11,
								color: theme.link,
								textDecoration: "none",
							}}
						>
							GH
						</a>
					)}
					{childCount > 0 && (
						<span style={{ fontSize: 11, color: theme.textMuted }}>
							{childCount}件
						</span>
					)}
					<TicketMenu
						menuOpen={menuOpen}
						ticketId={ticket.id}
						isInProgress={ticket.status === "in_progress"}
						onToggleMenu={onToggleMenu}
						onDecompose={onDecompose}
						onResetToTodo={onResetToTodo}
						onDelete={onDelete}
					/>
				</div>
			</div>
			{ticket.startPhase && ticket.startPhase !== "running" && (
				<div
					style={{
						fontSize: 11,
						color: theme.blue,
						display: "flex",
						alignItems: "center",
						gap: 4,
					}}
				>
					<span
						style={{
							display: "inline-block",
							width: 6,
							height: 6,
							borderRadius: "50%",
							backgroundColor:
								ticket.startPhase === "error" ? theme.red : theme.blue,
							animation:
								ticket.startPhase === "error" ? "none" : "pulse 1.5s infinite",
						}}
					/>
					{ticket.startPhase === "creating_worktree" && "Worktree作成中..."}
					{ticket.startPhase === "starting_claude" && "Claude Code起動中..."}
					{ticket.startPhase === "sending_prompt" && "プロンプト送信中..."}
					{ticket.startPhase === "error" && "起動エラー"}
				</div>
			)}
			{directoryName && (
				<span
					style={{
						fontSize: 10,
						padding: "1px 6px",
						backgroundColor: theme.tagBg,
						color: theme.tag,
						borderRadius: 3,
						border: `1px solid ${theme.tagBorder}`,
						alignSelf: "flex-start",
					}}
				>
					{directoryName}
				</span>
			)}
			{blockedByNames.length > 0 && (
				<div style={{ fontSize: 11, color: theme.yellow }}>
					待ち: {blockedByNames.join(", ")}
				</div>
			)}
		</li>
	);
}

function SubTicketCard({
	ticket,
	blockedByNames,
	onDelete,
}: {
	ticket: Ticket;
	blockedByNames: string[];
	onDelete: (id: string) => void;
}) {
	const { theme } = useTheme();
	return (
		<li
			style={{
				padding: "6px 10px",
				marginLeft: 12,
				backgroundColor: theme.bgInput,
				borderRadius: 4,
				borderLeft: `2px solid ${theme.border}`,
				display: "flex",
				flexDirection: "column",
				gap: 4,
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 6,
				}}
			>
				<span
					style={{
						fontSize: 13,
						color: theme.textLabel,
						wordBreak: "break-word",
						flex: 1,
					}}
				>
					{ticket.title}
				</span>
				<button
					type="button"
					onClick={() => onDelete(ticket.id)}
					style={{
						padding: "1px 5px",
						fontSize: 10,
						backgroundColor: "transparent",
						color: theme.textDim,
						border: `1px solid ${theme.border}`,
						borderRadius: 3,
						cursor: "pointer",
						flexShrink: 0,
					}}
				>
					削除
				</button>
			</div>
			{blockedByNames.length > 0 && (
				<div style={{ fontSize: 10, color: theme.yellow }}>
					待ち: {blockedByNames.join(", ")}
				</div>
			)}
		</li>
	);
}

function ColumnInput({ onAdd }: { onAdd: (title: string) => void }) {
	const { theme } = useTheme();
	const [title, setTitle] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = title.trim();
		if (!trimmed) return;
		onAdd(trimmed);
		setTitle("");
	};

	return (
		<li>
			<form onSubmit={handleSubmit} style={{ display: "flex", gap: 6 }}>
				<input
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="+ チケットを追加"
					style={{
						flex: 1,
						padding: "6px 8px",
						fontSize: 13,
						border: `1px solid ${theme.border}`,
						borderRadius: 4,
						backgroundColor: theme.bgInput,
						color: theme.text,
					}}
				/>
				<button
					type="submit"
					style={{
						padding: "6px 10px",
						fontSize: 13,
						backgroundColor: theme.accent,
						color: "#fff",
						border: "none",
						borderRadius: 4,
						cursor: "pointer",
						whiteSpace: "nowrap",
					}}
				>
					追加
				</button>
			</form>
		</li>
	);
}

export function KanbanBoard({
	tickets,
	dependencies,
	directories,
	onAdd,
	onChangeStatus,
	onDelete,
	onStart,
	onDecompose,
	onResetToTodo,
	onTicketClick,
	selectedTicketId,
	sessionStatuses,
}: Props) {
	const { theme } = useTheme();
	const columnColors = {
		todo: theme.columnTodo,
		in_progress: theme.columnInProgress,
	};
	const dirMap = new Map(directories.map((d) => [d.id, d.name]));
	const [expandedTickets, setExpandedTickets] = useState<Set<string>>(
		new Set(),
	);
	const toggleExpand = (ticketId: string) => {
		setExpandedTickets((prev) => {
			const next = new Set(prev);
			if (next.has(ticketId)) next.delete(ticketId);
			else next.add(ticketId);
			return next;
		});
	};
	const [openMenuId, setOpenMenuId] = useState<string | null>(null);

	// 外側クリックでメニューを閉じる
	useEffect(() => {
		if (!openMenuId) return;
		const close = () => setOpenMenuId(null);
		document.addEventListener("click", close);
		return () => document.removeEventListener("click", close);
	}, [openMenuId]);

	const handleDrop = (e: React.DragEvent, status: Status) => {
		e.preventDefault();
		const id = e.dataTransfer.getData("ticket-id");
		if (id) onChangeStatus(id, status);
	};

	const childrenMap = new Map<string, Ticket[]>();
	for (const t of tickets) {
		if (t.parentId) {
			const list = childrenMap.get(t.parentId) ?? [];
			list.push(t);
			childrenMap.set(t.parentId, list);
		}
	}

	const getBlockedByNames = (ticketId: string): string[] =>
		dependencies
			.filter((d) => d.fromTicketId === ticketId)
			.map((d) => tickets.find((t) => t.id === d.toTicketId)?.title)
			.filter((name): name is string => !!name);

	return (
		<div style={{ display: "flex", gap: 12, overflowX: "auto", flex: 1 }}>
			{STATUSES.map((status) => {
				const colors = columnColors[status];
				const columnTickets = tickets.filter(
					(t) => t.status === status && !t.parentId,
				);
				return (
					<div
						key={status}
						style={{
							flex: 1,
							minWidth: 180,
							backgroundColor: colors.bg,
							borderRadius: 8,
							border: `1px solid ${colors.border}`,
							display: "flex",
							flexDirection: "column",
						}}
					>
						<div
							style={{
								padding: "10px 14px",
								display: "flex",
								alignItems: "center",
								gap: 8,
								borderBottom: `1px solid ${colors.border}`,
							}}
						>
							<span
								style={{
									fontWeight: 600,
									fontSize: 14,
									color: theme.textLabel,
								}}
							>
								{STATUS_LABELS[status]}
							</span>
							<span
								style={{
									backgroundColor: colors.badge,
									color: "#fff",
									fontSize: 11,
									fontWeight: 600,
									padding: "1px 7px",
									borderRadius: 10,
								}}
							>
								{columnTickets.length}
							</span>
						</div>
						<ul
							onDragOver={(e) => e.preventDefault()}
							onDrop={(e) => handleDrop(e, status)}
							style={{
								listStyle: "none",
								margin: 0,
								padding: 10,
								display: "flex",
								flexDirection: "column",
								gap: 8,
								flex: 1,
								minHeight: 80,
							}}
						>
							{columnTickets.map((ticket) => {
								const children = (childrenMap.get(ticket.id) ?? []).filter(
									(c) => c.status === status,
								);
								return (
									<div
										key={ticket.id}
										style={{
											display: "flex",
											flexDirection: "column",
											gap: 4,
										}}
									>
										<TicketCard
											ticket={ticket}
											childCount={childrenMap.get(ticket.id)?.length ?? 0}
											blockedByNames={getBlockedByNames(ticket.id)}
											isSelected={selectedTicketId === ticket.id}
											directoryName={
												ticket.workDirectoryId
													? (dirMap.get(ticket.workDirectoryId) ?? null)
													: null
											}
											sessionStatus={
												sessionStatuses.get(ticket.id)?.status ?? null
											}
											hasChildren={children.length > 0}
											childrenExpanded={expandedTickets.has(ticket.id)}
											onToggleChildren={() => toggleExpand(ticket.id)}
											menuOpen={openMenuId === ticket.id}
											onDelete={onDelete}
											onStart={onStart}
											onDecompose={onDecompose}
											onResetToTodo={onResetToTodo}
											onToggleMenu={(id) =>
												setOpenMenuId(openMenuId === id ? null : id)
											}
											onClick={() => onTicketClick(ticket.id)}
										/>
										{expandedTickets.has(ticket.id) &&
											children.map((child) => (
												<SubTicketCard
													key={child.id}
													ticket={child}
													blockedByNames={getBlockedByNames(child.id)}
													onDelete={onDelete}
												/>
											))}
									</div>
								);
							})}
							<ColumnInput onAdd={(title) => onAdd(title, status)} />
						</ul>
					</div>
				);
			})}
		</div>
	);
}
