import { useEffect, useState } from "react";
import { useTheme } from "../lib/ThemeContext";
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
	const { theme } = useTheme();
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
		Map<
			string,
			{
				sessionName: string;
				cwd: string;
				status: "idle" | "working" | "error";
			}
		>
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
							status: "idle" | "working" | "error";
						}[],
					) => {
						const map = new Map<
							string,
							{
								sessionName: string;
								cwd: string;
								status: "idle" | "working" | "error";
							}
						>();
						for (const s of sessions) {
							map.set(s.ticketId, {
								sessionName: s.sessionName,
								cwd: s.cwd,
								status: s.status,
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

	const applyChanges = async (ticketId: string) => {
		const ticket = tickets.find((t) => t.id === ticketId);
		if (!ticket?.worktreePath || !ticket.workDirectoryId) return;
		const dir = directories.find((d) => d.id === ticket.workDirectoryId);
		if (!dir) return;
		await fetch("/api/sessions/main/send-keys", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				text: `以下のworktreeの変更をメインディレクトリに反映してください。
1. worktree "${ticket.worktreePath}" でbase_commit "${ticket.baseCommit}" からの差分をpatchファイルとして生成:
   cd "${ticket.worktreePath}" && git diff ${ticket.baseCommit} > /tmp/plx-patch-${ticketId}.patch
2. メインディレクトリ "${dir.path}" のリポジトリルートを特定し、そこからpatchを適用:
   REPO_ROOT=$(cd "${dir.path}" && git rev-parse --show-toplevel) && cd "$REPO_ROOT" && git apply --3way /tmp/plx-patch-${ticketId}.patch
3. コンフリクトがあれば解消してください
4. 適用したファイル一覧を表示してください`,
			}),
		});
	};

	const revertChanges = async (ticketId: string) => {
		const ticket = tickets.find((t) => t.id === ticketId);
		if (!ticket?.workDirectoryId) return;
		const dir = directories.find((d) => d.id === ticket.workDirectoryId);
		if (!dir) return;
		await fetch("/api/sessions/main/send-keys", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				text: `メインディレクトリ "${dir.path}" に先ほど反映したチケット "${ticket.title}" の変更を元に戻してください。
1. patchファイル /tmp/plx-patch-${ticketId}.patch が残っていればそれを使ってリポジトリルートから元に戻す:
   REPO_ROOT=$(cd "${dir.path}" && git rev-parse --show-toplevel) && cd "$REPO_ROOT" && git apply --reverse /tmp/plx-patch-${ticketId}.patch
   もし --reverse が失敗したら、git restore --staged --worktree で該当ファイルをHEADに戻す
2. patchファイルがなければ git restore --staged --worktree で変更を戻す（ただし他の変更も戻る旨を警告してください）
3. 戻したファイル一覧を表示してください`,
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

	const resetToTodo = async (id: string) => {
		setTickets((prev) =>
			prev.map((t) =>
				t.id === id
					? {
							...t,
							status: "todo" as const,
							startPhase: null,
							baseCommit: null,
							workDirectoryId: null,
							worktreePath: null,
						}
					: t,
			),
		);
		setActiveSessions((prev) => prev.filter((s) => s.ticketId !== id));
		if (selectedTicketId === id) setSelectedTicketId(null);
		await fetch(`/api/tickets/${id}/reset`, { method: "POST" });
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
		if (!ticket) return;

		// 作業中で未セットアップ（手動移動）の場合はホームで直接起動
		if (ticket.status === "in_progress" && !ticket.workDirectoryId) {
			handleConfirmStart(ticketId, "__home__", []);
			return;
		}

		setStartingTicket(ticket);
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

	const [filterDirId, setFilterDirId] = useState<string | null>(null);

	// ディレクトリでフィルタされたチケット
	const filteredTickets = filterDirId
		? tickets.filter((t) => t.workDirectoryId === filterDirId)
		: tickets;

	// フィルタ対象のディレクトリ（チケットが紐づいているもの）
	const activeDirectories = directories.filter((d) =>
		tickets.some((t) => t.workDirectoryId === d.id),
	);

	return (
		<div
			style={{
				height: "100%",
				overflow: "auto",
				padding: 24,
			}}
		>
			{activeDirectories.length > 0 && (
				<div
					style={{
						display: "flex",
						gap: 0,
						marginBottom: 16,
						borderBottom: `1px solid ${theme.border}`,
					}}
				>
					<button
						type="button"
						onClick={() => setFilterDirId(null)}
						style={{
							padding: "6px 14px",
							fontSize: 12,
							border: "none",
							borderBottom:
								filterDirId === null
									? `2px solid ${theme.accent}`
									: "2px solid transparent",
							backgroundColor: "transparent",
							color: filterDirId === null ? theme.text : theme.textDim,
							cursor: "pointer",
						}}
					>
						All
					</button>
					{activeDirectories.map((d) => (
						<button
							key={d.id}
							type="button"
							onClick={() => setFilterDirId(d.id)}
							style={{
								padding: "6px 14px",
								fontSize: 12,
								border: "none",
								borderBottom:
									filterDirId === d.id
										? `2px solid ${theme.accent}`
										: "2px solid transparent",
								backgroundColor: "transparent",
								color: filterDirId === d.id ? theme.text : theme.textDim,
								cursor: "pointer",
							}}
						>
							{d.name}
							<span
								style={{ marginLeft: 4, fontSize: 10, color: theme.textDim }}
							>
								{tickets.filter((t) => t.workDirectoryId === d.id).length}
							</span>
						</button>
					))}
				</div>
			)}
			<KanbanBoard
				tickets={filteredTickets}
				dependencies={dependencies}
				directories={directories}
				onAdd={addTicket}
				onChangeStatus={changeStatus}
				onDelete={deleteTicket}
				onStart={handleStart}
				onDecompose={decomposeTicket}
				onResetToTodo={resetToTodo}
				onTicketClick={handleTicketClick}
				selectedTicketId={selectedTicketId}
				sessionStatuses={knownSessions}
			/>

			{selectedTicket && (
				<TicketDetail
					ticket={selectedTicket}
					session={selectedSession}
					onClose={() => setSelectedTicketId(null)}
					onUpdate={updateTicket}
					onCreatePR={createPR}
					onApply={applyChanges}
					onRevert={revertChanges}
					onStart={handleStart}
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
