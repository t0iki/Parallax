export interface GitHubIssue {
	title: string;
	body: string | null;
	labels: string[];
	state: string;
	url: string;
}

export interface CreatePRResult {
	url: string;
	number: number;
	title: string;
}

export function parseGitHubIssueUrl(
	url: string,
): { owner: string; repo: string; number: number } | null {
	const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
	if (!match) return null;
	return { owner: match[1], repo: match[2], number: Number(match[3]) };
}

function githubHeaders(): Record<string, string> {
	const headers: Record<string, string> = {
		Accept: "application/vnd.github.v3+json",
		"User-Agent": "zanki-todo",
	};
	if (process.env.GITHUB_TOKEN) {
		headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
	}
	return headers;
}

export async function fetchGitHubIssue(url: string): Promise<GitHubIssue> {
	const parsed = parseGitHubIssueUrl(url);
	if (!parsed) throw new Error(`Invalid GitHub Issue URL: ${url}`);

	const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/issues/${parsed.number}`;
	const res = await fetch(apiUrl, { headers: githubHeaders() });
	if (!res.ok) {
		throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
	}

	const data = await res.json();
	return {
		title: data.title,
		body: data.body,
		labels: data.labels?.map((l: { name: string }) => l.name) ?? [],
		state: data.state,
		url: data.html_url,
	};
}

export function parseGitRemoteUrl(
	remoteUrl: string,
): { owner: string; repo: string } | null {
	// SSH: git@github.com:owner/repo.git
	const sshMatch = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
	if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };
	return null;
}

export async function createPullRequest(params: {
	owner: string;
	repo: string;
	title: string;
	body: string;
	head: string;
	base: string;
}): Promise<CreatePRResult> {
	const res = await fetch(
		`https://api.github.com/repos/${params.owner}/${params.repo}/pulls`,
		{
			method: "POST",
			headers: {
				...githubHeaders(),
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				title: params.title,
				body: params.body,
				head: params.head,
				base: params.base,
			}),
		},
	);
	if (!res.ok) {
		const err = await res.text();
		throw new Error(`GitHub API error: ${res.status} ${err}`);
	}
	const data = await res.json();
	return {
		url: data.html_url,
		number: data.number,
		title: data.title,
	};
}
