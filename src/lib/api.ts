export async function api<T>(path: string, options?: RequestInit): Promise<T> {
	const res = await fetch(path, {
		headers: { "Content-Type": "application/json" },
		...options,
	});
	return res.json();
}

export async function apiText(path: string): Promise<string> {
	const res = await fetch(path);
	return res.text();
}
