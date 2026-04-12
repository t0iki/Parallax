import { useEffect, useState } from "react";
import type { Directory } from "../types/directory";
import type { Status, Ticket, TicketDependency } from "../types/ticket";
import { KanbanBoard } from "./KanbanBoard";
import { StartTicketDialog } from "./StartTicketDialog";
import { TicketDetail } from "./TicketDetail";

type ActiveSession = {
	ticketId: string;
	sessionName: string;
	cwd: string;
	addDirPaths: string[];
};

export function TodoApp() {
	const [tickets, setTickets] = useState<Ticket[]>([]);
	const [dependencies, setDependencies] = useState<TicketDependency[]>([]);
	const [directories, setDirectories] = useState<Directory[]>([]);
	const [startingTicket, setStartingTicket] = useState<Ticket | null>(null);
	const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
	const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

	useEffect(() => {
		const fetchAll = () => {
			fetch("/api/tickets")
				.then((res) => res.json())
				.then(setTickets);
			fetch("/api/tickets/dependencies")
				.then((res) => res.json())
				.then(setDependencies);
			fetch("/api/directories")
				.then((res) => res.json())
				.then(setDirectories);
		};
		fetchAll();
		const id = setInterval(fetchAll, 2000);
		return () => clearInterval(id);
	}, []);

	// サーバー上のアクティブセッション一覧
	const [knownSessions, setKnownSessions] = useState<
		Map<string, { sessionName: string; cwd: string }>
	>(new Map());

	useEffect(() => {
		const fetchSessions = () =>
			fetch("/api/sessions")
				.then((res) => res.json())
				.then(
					(
						sessions: {
							ticketId: string;
							sessionName: string;
							cwd: string;
						}[],
					) => {
						const map = new Map<string, { sessionName: string; cwd: string }>();
						for (const s of sessions) {
							map.set(s.ticketId, {
								sessionName: s.sessionName,
								cwd: s.cwd,
							});
						}
						setKnownSessions(map);
					},
				);
		fetchSessions();
		const id = setInterval(fetchSessions, 5000);
		return () => clearInterval(id);
	}, []);

	const addTicket = async (title: string, status: Status) => {
		const ticket: Ticket = {
			id: crypto.randomUUID(),
			title,
			description: "",
			sourceUrl: null,
			parentId: null,
			status,
			baseCommit: null,
			workDirectoryId: null,
			worktreePath: null,
			startPhase: null,
			directoryIds: [],
			createdAt: Date.now(),
		};
		setTickets((prev) => [...prev, ticket]);
		await fetch("/api/tickets", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(ticket),
		});
	};

	const changeStatus = async (id: string, status: Status) => {
		setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
		await fetch(`/api/tickets/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status }),
		});
	};

	const updateTicket = async (
		id: string,
		fields: { title?: string; description?: string },
	) => {
		setTickets((prev) =>
			prev.map((t) => (t.id === id ? { ...t, ...fields } : t)),
		);
		await fetch(`/api/tickets/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(fields),
		});
	};

	const decomposeTicket = async (ticketId: string) => {
		const ticket = tickets.find((t) => t.id === ticketId);
		if (!ticket) return;
		const desc = ticket.description ? `\n\n説明:\n${ticket.description}` : "";
		await fetch("/api/sessions/main/send-keys", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				text: `以下のチケットをサブタスクに分解して、plx-todo MCPのcreate_ticketで親チケットID "${ticketId}" を指定してサブタスクを作成してください。必要に応じてadd_dependencyで依存関係も設定してください。\n\nチケット: ${ticket.title}${desc}`,
			}),
		});
	};

	const createPR = async (ticketId: string) => {
		const session = activeSessions.find((s) => s.ticketId === ticketId);
		if (!session) return;
		await fetch(`/api/tickets/${ticketId}/send-keys`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				text: "これまでの変更内容をコミットし、ブランチをpushして、プルリクエストを作成してください。ghコマンドがTLSエラーで使えない場合は、git pushだけ行い、PRのURLは手動で作成する旨を伝えてください。",
			}),
		});
	};

	const deleteTicket = async (id: string) => {
		setTickets((prev) => prev.filter((t) => t.id !== id));
		setActiveSessions((prev) => prev.filter((s) => s.ticketId !== id));
		if (selectedTicketId === id) setSelectedTicketId(null);
		await fetch(`/api/tickets/${id}`, { method: "DELETE" });
	};

	const handleStart = (ticketId: string) => {
		// 既にセッションがあればそれを開く
		const existing = activeSessions.find((s) => s.ticketId === ticketId);
		if (existing) {
			setSelectedTicketId(ticketId);
			return;
		}

		const known = knownSessions.get(ticketId);
		if (known) {
			setActiveSessions((prev) => [
				...prev,
				{
					ticketId,
					sessionName: known.sessionName,
					cwd: known.cwd,
					addDirPaths: [],
				},
			]);
			setSelectedTicketId(ticketId);
			return;
		}

		const ticket = tickets.find((t) => t.id === ticketId);
		if (ticket) setStartingTicket(ticket);
	};

	const handleConfirmStart = async (
		ticketId: string,
		directoryId: string,
		addDirectoryIds: string[],
	) => {
		setStartingTicket(null);

		const res = await fetch(`/api/tickets/${ticketId}/start`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ directoryId, addDirectoryIds }),
		});
		const { sessionName, cwd, addDirPaths } = await res.json();

		setActiveSessions((prev) => [
			...prev.filter((s) => s.ticketId !== ticketId),
			{ ticketId, sessionName, cwd, addDirPaths },
		]);
		setSelectedTicketId(ticketId);
	};

	const handleTicketClick = (ticketId: string) => {
		if (selectedTicketId === ticketId) {
			setSelectedTicketId(null);
			return;
		}
		// knownSessionsにあればactiveSessionsに追加
		if (
			!activeSessions.find((s) => s.ticketId === ticketId) &&
			knownSessions.has(ticketId)
		) {
			const known = knownSessions.get(ticketId);
			if (!known) return;
			setActiveSessions((prev) => [
				...prev,
				{
					ticketId,
					sessionName: known.sessionName,
					cwd: known.cwd,
					addDirPaths: [],
				},
			]);
		}
		setSelectedTicketId(ticketId);
	};

	const selectedTicket = tickets.find((t) => t.id === selectedTicketId);
	const selectedSession =
		activeSessions.find((s) => s.ticketId === selectedTicketId) ?? null;

	return (
		<div
			style={{
				height: "100%",
				overflow: "auto",
				padding: 24,
			}}
		>
			<KanbanBoard
				tickets={tickets}
				dependencies={dependencies}
				directories={directories}
				onAdd={addTicket}
				onChangeStatus={changeStatus}
				onDelete={deleteTicket}
				onStart={handleStart}
				onTicketClick={handleTicketClick}
				selectedTicketId={selectedTicketId}
			/>

			{selectedTicket && (
				<TicketDetail
					ticket={selectedTicket}
					session={selectedSession}
					onClose={() => setSelectedTicketId(null)}
					onUpdate={updateTicket}
					onCreatePR={createPR}
					onDecompose={decomposeTicket}
				/>
			)}

			{startingTicket && (
				<StartTicketDialog
					ticket={startingTicket}
					directories={directories}
					onConfirm={handleConfirmStart}
					onCancel={() => setStartingTicket(null)}
				/>
			)}
		</div>
	);
}
