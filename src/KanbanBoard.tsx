import { useState } from "react";
import type { Directory } from "./directory";
import {
	STATUS_LABELS,
	STATUSES,
	type Status,
	type Ticket,
	type TicketDependency,
} from "./ticket";

type Props = {
	tickets: Ticket[];
	dependencies: TicketDependency[];
	directories: Directory[];
	onAdd: (title: string, status: Status) => void;
	onChangeStatus: (id: string, status: Status) => void;
	onDelete: (id: string) => void;
	onStart: (ticketId: string) => void;
	onTicketClick: (ticketId: string) => void;
	selectedTicketId: string | null;
};

const COLUMN_COLORS: Record<
	Status,
	{ bg: string; border: string; badge: string }
> = {
	todo: { bg: "#1c1c28", border: "#2a2a35", badge: "#6c757d" },
	in_progress: { bg: "#1f1c14", border: "#3d3520", badge: "#c68a1a" },
};

function TicketCard({
	ticket,
	childCount,
	blockedByNames,
	isSelected,
	directoryName,
	onDelete,
	onStart,
	onClick,
}: {
	ticket: Ticket;
	childCount: number;
	blockedByNames: string[];
	isSelected: boolean;
	directoryName: string | null;
	onDelete: (id: string) => void;
	onStart: (ticketId: string) => void;
	onClick: () => void;
}) {
	return (
		<li
			draggable
			onDragStart={(e) => e.dataTransfer.setData("ticket-id", ticket.id)}
			onClick={onClick}
			onKeyDown={(e) => e.key === "Enter" && onClick()}
			style={{
				padding: "10px 12px",
				backgroundColor: isSelected ? "#252540" : "#1e1e2e",
				borderRadius: 6,
				border: isSelected ? "1px solid #3a3a60" : "1px solid #2a2a35",
				boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
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
				<span
					style={{
						fontSize: 14,
						wordBreak: "break-word",
						color: "#ddd",
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
					<button
						type="button"
						onClick={() => onStart(ticket.id)}
						style={{
							padding: "2px 6px",
							fontSize: 11,
							backgroundColor: "transparent",
							color: "#43a047",
							border: "1px solid #2e7d32",
							borderRadius: 4,
							cursor: "pointer",
						}}
					>
						▶
					</button>
					{ticket.sourceUrl && (
						<a
							href={ticket.sourceUrl}
							target="_blank"
							rel="noopener noreferrer"
							onClick={(e) => e.stopPropagation()}
							style={{
								fontSize: 11,
								color: "#6c8ebf",
								textDecoration: "none",
							}}
						>
							GH
						</a>
					)}
					{childCount > 0 && (
						<span style={{ fontSize: 11, color: "#888" }}>{childCount}件</span>
					)}
					<button
						type="button"
						onClick={() => onDelete(ticket.id)}
						style={{
							padding: "2px 6px",
							fontSize: 11,
							backgroundColor: "transparent",
							color: "#666",
							border: "1px solid #333",
							borderRadius: 4,
							cursor: "pointer",
						}}
					>
						削除
					</button>
				</div>
			</div>
			{ticket.startPhase && ticket.startPhase !== "running" && (
				<div
					style={{
						fontSize: 11,
						color: "#58a6ff",
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
								ticket.startPhase === "error" ? "#f85149" : "#58a6ff",
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
						backgroundColor: "#2a2a40",
						color: "#8b9dc3",
						borderRadius: 3,
						border: "1px solid #3a3a50",
						alignSelf: "flex-start",
					}}
				>
					{directoryName}
				</span>
			)}
			{blockedByNames.length > 0 && (
				<div style={{ fontSize: 11, color: "#c68a1a" }}>
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
	return (
		<li
			draggable
			onDragStart={(e) => e.dataTransfer.setData("ticket-id", ticket.id)}
			style={{
				padding: "6px 10px",
				marginLeft: 12,
				backgroundColor: "#1a1a28",
				borderRadius: 4,
				borderLeft: "2px solid #2a2a35",
				cursor: "grab",
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
						color: "#bbb",
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
						color: "#555",
						border: "1px solid #2a2a35",
						borderRadius: 3,
						cursor: "pointer",
						flexShrink: 0,
					}}
				>
					削除
				</button>
			</div>
			{blockedByNames.length > 0 && (
				<div style={{ fontSize: 10, color: "#c68a1a" }}>
					待ち: {blockedByNames.join(", ")}
				</div>
			)}
		</li>
	);
}

function ColumnInput({ onAdd }: { onAdd: (title: string) => void }) {
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
						border: "1px solid #2a2a35",
						borderRadius: 4,
						backgroundColor: "#16161e",
						color: "#ccc",
					}}
				/>
				<button
					type="submit"
					style={{
						padding: "6px 10px",
						fontSize: 13,
						backgroundColor: "#2563eb",
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
	onTicketClick,
	selectedTicketId,
}: Props) {
	const dirMap = new Map(directories.map((d) => [d.id, d.name]));
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
				const colors = COLUMN_COLORS[status];
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
							<span style={{ fontWeight: 600, fontSize: 14, color: "#bbb" }}>
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
											onDelete={onDelete}
											onStart={onStart}
											onClick={() => onTicketClick(ticket.id)}
										/>
										{children.map((child) => (
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
