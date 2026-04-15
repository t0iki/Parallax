export const STATUSES = ["todo", "in_progress", "done"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
	todo: "TODO",
	in_progress: "作業中",
	done: "完了",
};

export type Ticket = {
	id: string;
	title: string;
	description: string;
	sourceUrl: string | null;
	parentId: string | null;
	status: Status;
	baseCommit: string | null;
	workDirectoryId: string | null;
	worktreePath: string | null;
	startPhase: string | null;
	directoryIds: string[];
	createdAt: number;
};

export type TicketDependency = {
	id: string;
	fromTicketId: string;
	toTicketId: string;
	createdAt: number;
};
