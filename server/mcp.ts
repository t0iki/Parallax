import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createPullRequest, fetchGitHubIssue } from "./github.js";

const API_BASE = "http://localhost:24510/api";

const server = new McpServer({
	name: "plx-todo",
	version: "1.0.0",
});

server.tool("list_tickets", "Todoリストのチケット一覧を取得する", async () => {
	const res = await fetch(`${API_BASE}/tickets`);
	const tickets = await res.json();
	return {
		content: [{ type: "text", text: JSON.stringify(tickets, null, 2) }],
	};
});

server.tool(
	"create_ticket",
	"新しいチケットを作成する",
	{
		title: z.string().describe("チケットのタイトル"),
		description: z.string().default("").describe("チケットの詳細説明"),
		status: z
			.enum(["todo", "in_progress"])
			.default("todo")
			.describe("ステータス (todo, in_progress, done)"),
		parentId: z
			.string()
			.optional()
			.describe("親チケットのID（サブタスクの場合）"),
		sourceUrl: z.string().optional().describe("ソースURL（GitHub Issueなど）"),
	},
	async ({ title, description, status, parentId, sourceUrl }) => {
		const ticket = {
			id: crypto.randomUUID(),
			title,
			description,
			status,
			parentId: parentId ?? null,
			sourceUrl: sourceUrl ?? null,
			createdAt: Date.now(),
		};
		const res = await fetch(`${API_BASE}/tickets`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(ticket),
		});
		const created = await res.json();
		return {
			content: [{ type: "text", text: JSON.stringify(created, null, 2) }],
		};
	},
);

server.tool(
	"update_ticket",
	"チケットを更新する（ステータス、タイトル、説明を変更可能）",
	{
		id: z.string().describe("チケットのID"),
		status: z
			.enum(["todo", "in_progress"])
			.optional()
			.describe("新しいステータス"),
		title: z.string().optional().describe("新しいタイトル"),
		description: z.string().optional().describe("新しい説明"),
	},
	async ({ id, status, title, description }) => {
		const body: Record<string, string> = {};
		if (status) body.status = status;
		if (title) body.title = title;
		if (description !== undefined) body.description = description;
		const res = await fetch(`${API_BASE}/tickets/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		const updated = await res.json();
		return {
			content: [{ type: "text", text: JSON.stringify(updated, null, 2) }],
		};
	},
);

server.tool(
	"update_ticket_status",
	"チケットのステータスを変更する",
	{
		id: z.string().describe("チケットのID"),
		status: z.enum(["todo", "in_progress"]).describe("新しいステータス"),
	},
	async ({ id, status }) => {
		const res = await fetch(`${API_BASE}/tickets/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status }),
		});
		const updated = await res.json();
		return {
			content: [{ type: "text", text: JSON.stringify(updated, null, 2) }],
		};
	},
);

server.tool(
	"delete_ticket",
	"チケットを削除する",
	{
		id: z.string().describe("チケットのID"),
	},
	async ({ id }) => {
		const res = await fetch(`${API_BASE}/tickets/${id}`, { method: "DELETE" });
		const deleted = await res.json();
		return {
			content: [{ type: "text", text: JSON.stringify(deleted, null, 2) }],
		};
	},
);

server.tool(
	"fetch_github_issue",
	"GitHub IssueのURLからIssueの内容を取得する",
	{
		url: z
			.string()
			.describe(
				"GitHub IssueのURL (例: https://github.com/owner/repo/issues/123)",
			),
	},
	async ({ url }) => {
		try {
			const issue = await fetchGitHubIssue(url);
			return {
				content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
			};
		} catch (err) {
			return {
				content: [
					{
						type: "text",
						text: `Error: ${err instanceof Error ? err.message : String(err)}`,
					},
				],
			};
		}
	},
);

server.tool(
	"create_ticket_from_github_issue",
	"GitHub IssueのURLからチケットを自動作成する。Issueのタイトルと本文をチケットに反映する。レスポンスにIssue本文が含まれるので、サブタスク分解に活用できる",
	{
		url: z.string().describe("GitHub IssueのURL"),
		status: z
			.enum(["todo", "in_progress"])
			.default("todo")
			.describe("ステータス"),
		parentId: z.string().optional().describe("親チケットのID"),
	},
	async ({ url, status, parentId }) => {
		try {
			const issue = await fetchGitHubIssue(url);
			const ticket = {
				id: crypto.randomUUID(),
				title: issue.title,
				description: issue.body ?? "",
				status,
				parentId: parentId ?? null,
				sourceUrl: issue.url,
				createdAt: Date.now(),
			};
			const res = await fetch(`${API_BASE}/tickets`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(ticket),
			});
			const created = await res.json();
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								ticket: created,
								issue: { body: issue.body, labels: issue.labels },
							},
							null,
							2,
						),
					},
				],
			};
		} catch (err) {
			return {
				content: [
					{
						type: "text",
						text: `Error: ${err instanceof Error ? err.message : String(err)}`,
					},
				],
			};
		}
	},
);

server.tool(
	"add_dependency",
	"チケット間の依存関係を追加する（fromTicketIdはtoTicketIdの完了後に実行すべき）",
	{
		fromTicketId: z
			.string()
			.describe("依存する側のチケットID（後に実行するタスク）"),
		toTicketId: z
			.string()
			.describe("依存される側のチケットID（先に実行するタスク）"),
	},
	async ({ fromTicketId, toTicketId }) => {
		const dep = {
			id: crypto.randomUUID(),
			fromTicketId,
			toTicketId,
			createdAt: Date.now(),
		};
		const res = await fetch(`${API_BASE}/tickets/dependencies`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(dep),
		});
		if (!res.ok) {
			const err = await res.json();
			return { content: [{ type: "text", text: `Error: ${err.error}` }] };
		}
		const created = await res.json();
		return {
			content: [{ type: "text", text: JSON.stringify(created, null, 2) }],
		};
	},
);

server.tool(
	"remove_dependency",
	"チケット間の依存関係を削除する",
	{
		id: z.string().describe("依存関係のID"),
	},
	async ({ id }) => {
		const res = await fetch(`${API_BASE}/tickets/dependencies/${id}`, {
			method: "DELETE",
		});
		const deleted = await res.json();
		return {
			content: [{ type: "text", text: JSON.stringify(deleted, null, 2) }],
		};
	},
);

server.tool(
	"list_dependencies",
	"チケット間の依存関係一覧を取得する",
	async () => {
		const res = await fetch(`${API_BASE}/tickets/dependencies`);
		const deps = await res.json();
		return {
			content: [{ type: "text", text: JSON.stringify(deps, null, 2) }],
		};
	},
);

server.tool(
	"create_pull_request",
	"GitHub にプルリクエストを作成する。事前に変更をコミットしてpushしておくこと",
	{
		owner: z.string().describe("リポジトリオーナー (例: plaidev)"),
		repo: z.string().describe("リポジトリ名 (例: karte-io-systems)"),
		head: z.string().describe("PRのブランチ名（pushしたブランチ）"),
		base: z.string().describe("マージ先のブランチ名 (例: main)"),
		title: z.string().describe("PRのタイトル"),
		body: z.string().default("").describe("PRの説明"),
	},
	async ({ owner, repo, head, base, title, body }) => {
		try {
			const pr = await createPullRequest({
				owner,
				repo,
				title,
				body,
				head,
				base,
			});
			return {
				content: [{ type: "text", text: JSON.stringify(pr, null, 2) }],
			};
		} catch (err) {
			return {
				content: [
					{
						type: "text",
						text: `Error: ${err instanceof Error ? err.message : String(err)}`,
					},
				],
			};
		}
	},
);

const transport = new StdioServerTransport();
await server.connect(transport);
