export type DiffLineType = "add" | "delete" | "context";

export type DiffLine = {
	type: DiffLineType;
	content: string;
	oldLineNo: number | null;
	newLineNo: number | null;
};

export type DiffHunk = {
	header: string;
	lines: DiffLine[];
};

export function parseDiff(raw: string): DiffHunk[] {
	const hunks: DiffHunk[] = [];
	let current: DiffHunk | null = null;
	let oldLine = 0;
	let newLine = 0;

	for (const line of raw.split("\n")) {
		if (line.startsWith("@@")) {
			const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
			oldLine = match ? Number(match[1]) : 0;
			newLine = match ? Number(match[2]) : 0;
			current = { header: line, lines: [] };
			hunks.push(current);
			continue;
		}

		if (!current) continue;
		if (line.startsWith("---") || line.startsWith("+++")) continue;
		if (line.startsWith("\\")) continue; // "\ No newline at end of file"

		if (line.startsWith("+")) {
			current.lines.push({
				type: "add",
				content: line.slice(1),
				oldLineNo: null,
				newLineNo: newLine++,
			});
		} else if (line.startsWith("-")) {
			current.lines.push({
				type: "delete",
				content: line.slice(1),
				oldLineNo: oldLine++,
				newLineNo: null,
			});
		} else {
			current.lines.push({
				type: "context",
				content: line.startsWith(" ") ? line.slice(1) : line,
				oldLineNo: oldLine++,
				newLineNo: newLine++,
			});
		}
	}

	return hunks;
}
