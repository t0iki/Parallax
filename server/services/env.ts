import fs from "node:fs";
import path from "node:path";

const COMMON_BIN_DIRS = [
	"/opt/homebrew/bin",
	"/opt/homebrew/sbin",
	"/usr/local/bin",
	"/usr/bin",
	"/bin",
	"/usr/sbin",
	"/sbin",
];

export function ensurePath(): void {
	const current = process.env.PATH ? process.env.PATH.split(":") : [];
	const merged: string[] = [];
	const seen = new Set<string>();
	for (const dir of [...current, ...COMMON_BIN_DIRS]) {
		if (!dir || seen.has(dir)) continue;
		seen.add(dir);
		merged.push(dir);
	}
	process.env.PATH = merged.join(":");
}

export function findBinary(
	name: string,
	extraDirs: string[] = [],
): string | null {
	const dirs = [
		...(process.env.PATH ? process.env.PATH.split(":") : []),
		...COMMON_BIN_DIRS,
		...extraDirs,
	];
	for (const dir of dirs) {
		if (!dir) continue;
		const full = path.join(dir, name);
		try {
			fs.accessSync(full, fs.constants.X_OK);
			return full;
		} catch {
			// not here
		}
	}
	return null;
}
