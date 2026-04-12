import type http from "node:http";
import db from "../db.js";
import { json, readBody } from "../utils.js";

export async function handleDirectories(
	req: http.IncomingMessage,
	res: http.ServerResponse,
	url: URL,
): Promise<boolean> {
	// GET /api/directories
	if (req.method === "GET" && url.pathname === "/api/directories") {
		const rows = db
			.prepare(
				"SELECT id, name, path, main_branch as mainBranch, branch_template as branchTemplate, created_at as createdAt FROM directories ORDER BY created_at",
			)
			.all();
		json(res, 200, rows);
		return true;
	}

	// POST /api/directories
	if (req.method === "POST" && url.pathname === "/api/directories") {
		const body = JSON.parse(await readBody(req));
		db.prepare(
			"INSERT INTO directories (id, name, path, main_branch, branch_template, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		).run(
			body.id,
			body.name,
			body.path,
			body.mainBranch ?? "main",
			body.branchTemplate ?? "{title}",
			body.createdAt,
		);
		json(res, 201, body);
		return true;
	}

	// PATCH /api/directories/:id
	const patchMatch = url.pathname.match(/^\/api\/directories\/([^/]+)$/);
	if (req.method === "PATCH" && patchMatch) {
		const id = patchMatch[1];
		const body = JSON.parse(await readBody(req));
		const fields: string[] = [];
		const values: unknown[] = [];
		if (body.name !== undefined) {
			fields.push("name = ?");
			values.push(body.name);
		}
		if (body.path !== undefined) {
			fields.push("path = ?");
			values.push(body.path);
		}
		if (body.mainBranch !== undefined) {
			fields.push("main_branch = ?");
			values.push(body.mainBranch);
		}
		if (body.branchTemplate !== undefined) {
			fields.push("branch_template = ?");
			values.push(body.branchTemplate);
		}
		if (fields.length > 0) {
			values.push(id);
			db.prepare(
				`UPDATE directories SET ${fields.join(", ")} WHERE id = ?`,
			).run(...values);
		}
		json(res, 200, { id, ...body });
		return true;
	}

	// DELETE /api/directories/:id
	const deleteMatch = url.pathname.match(/^\/api\/directories\/([^/]+)$/);
	if (req.method === "DELETE" && deleteMatch) {
		const id = deleteMatch[1];
		db.prepare("DELETE FROM directories WHERE id = ?").run(id);
		json(res, 200, { id });
		return true;
	}

	return false;
}
