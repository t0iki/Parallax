import { useEffect, useState } from "react";
import { type DiffHunk, parseDiff } from "./diffParser";

type DiffFile = { status: string; path: string };

type TreeNode = {
	name: string;
	fullPath: string;
	type: "file" | "directory";
	status?: string;
	children: TreeNode[];
};

function buildTree(files: DiffFile[]): TreeNode[] {
	const root: TreeNode[] = [];
	for (const f of files) {
		const parts = f.path.split("/");
		let nodes = root;
		for (let i = 0; i < parts.length; i++) {
			const name = parts[i];
			const isFile = i === parts.length - 1;
			let node = nodes.find(
				(n) => n.name === name && n.type === (isFile ? "file" : "directory"),
			);
			if (!node) {
				node = {
					name,
					fullPath: parts.slice(0, i + 1).join("/"),
					type: isFile ? "file" : "directory",
					status: isFile ? f.status : undefined,
					children: [],
				};
				nodes.push(node);
			}
			nodes = node.children;
		}
	}
	return root;
}

const STATUS_COLORS: Record<string, string> = {
	M: "#c68a1a",
	A: "#43a047",
	D: "#f85149",
};

function FileTree({
	nodes,
	depth,
	selectedPath,
	onSelect,
}: {
	nodes: TreeNode[];
	depth: number;
	selectedPath: string | null;
	onSelect: (path: string) => void;
}) {
	return (
		<>
			{nodes.map((node) => (
				<div key={node.fullPath}>
					{node.type === "file" ? (
						<button
							type="button"
							onClick={() => onSelect(node.fullPath)}
							style={{
								all: "unset",
								display: "flex",
								alignItems: "center",
								gap: 6,
								width: "100%",
								padding: "3px 8px",
								paddingLeft: depth * 16 + 8,
								fontSize: 12,
								color: selectedPath === node.fullPath ? "#ddd" : "#aaa",
								backgroundColor:
									selectedPath === node.fullPath ? "#2a2a40" : "transparent",
								borderRadius: 3,
								cursor: "pointer",
								boxSizing: "border-box",
							}}
						>
							<span
								style={{
									fontSize: 10,
									fontWeight: 600,
									color: STATUS_COLORS[node.status ?? ""] ?? "#888",
									minWidth: 12,
								}}
							>
								{node.status}
							</span>
							{node.name}
						</button>
					) : (
						<div
							style={{
								padding: "3px 8px",
								paddingLeft: depth * 16 + 8,
								fontSize: 12,
								color: "#777",
								fontWeight: 600,
							}}
						>
							{node.name}/
						</div>
					)}
					{node.children.length > 0 && (
						<FileTree
							nodes={node.children}
							depth={depth + 1}
							selectedPath={selectedPath}
							onSelect={onSelect}
						/>
					)}
				</div>
			))}
		</>
	);
}

const LINE_STYLES: Record<string, React.CSSProperties> = {
	add: { backgroundColor: "rgba(46, 160, 67, 0.15)", color: "#3fb950" },
	delete: { backgroundColor: "rgba(248, 81, 73, 0.15)", color: "#f85149" },
	context: { backgroundColor: "transparent", color: "#8b949e" },
};

function DiffContent({ hunks }: { hunks: DiffHunk[] }) {
	return (
		<div style={{ fontFamily: "monospace", fontSize: 12 }}>
			{hunks.map((hunk, i) => (
				<div key={hunk.header + String(i)}>
					<div
						style={{
							backgroundColor: "rgba(56, 139, 253, 0.1)",
							color: "#58a6ff",
							padding: "4px 12px",
							fontSize: 11,
						}}
					>
						{hunk.header}
					</div>
					{hunk.lines.map((line) => (
						<div
							key={`${line.type}-${line.oldLineNo}-${line.newLineNo}`}
							style={{
								display: "flex",
								...LINE_STYLES[line.type],
							}}
						>
							<span
								style={{
									width: 45,
									textAlign: "right",
									padding: "0 6px",
									color: "#484f58",
									userSelect: "none",
									flexShrink: 0,
									borderRight: "1px solid #2a2a35",
								}}
							>
								{line.oldLineNo ?? ""}
							</span>
							<span
								style={{
									width: 45,
									textAlign: "right",
									padding: "0 6px",
									color: "#484f58",
									userSelect: "none",
									flexShrink: 0,
									borderRight: "1px solid #2a2a35",
								}}
							>
								{line.newLineNo ?? ""}
							</span>
							<span style={{ padding: "0 8px", whiteSpace: "pre" }}>
								{line.type === "add" ? "+" : line.type === "delete" ? "-" : " "}
								{line.content}
							</span>
						</div>
					))}
				</div>
			))}
		</div>
	);
}

export function DiffView({ ticketId }: { ticketId: string }) {
	const [files, setFiles] = useState<DiffFile[]>([]);
	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	const [hunks, setHunks] = useState<DiffHunk[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchFiles = () => {
		fetch(`/api/tickets/${ticketId}/diff`)
			.then((res) => res.json())
			.then((data) => {
				if (data.error) {
					setError(data.error);
					return;
				}
				setFiles(data.files ?? []);
				setError(null);
			})
			.catch(() => setError("Failed to fetch diff"));
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: fetchFiles uses ticketId
	useEffect(() => {
		fetchFiles();
	}, [ticketId]);

	useEffect(() => {
		if (!selectedFile) {
			setHunks([]);
			return;
		}
		setLoading(true);
		const url = `/api/tickets/${ticketId}/diff/${selectedFile.split("/").map(encodeURIComponent).join("/")}`;
		console.log("[DiffView] fetching file diff:", url);
		fetch(url)
			.then((res) => {
				console.log("[DiffView] response status:", res.status);
				return res.text();
			})
			.then((text) => {
				console.log("[DiffView] diff text length:", text.length);
				setHunks(parseDiff(text));
				setLoading(false);
			})
			.catch((err) => {
				console.error("[DiffView] fetch error:", err);
				setLoading(false);
			});
	}, [ticketId, selectedFile]);

	if (error) {
		return (
			<div style={{ padding: 24, color: "#f85149", fontSize: 13 }}>{error}</div>
		);
	}

	if (files.length === 0 && !loading) {
		return (
			<div style={{ padding: 24, color: "#555", fontSize: 13 }}>
				変更されたファイルはありません
			</div>
		);
	}

	const tree = buildTree(files);

	return (
		<div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
			<div
				style={{
					width: 240,
					flexShrink: 0,
					borderRight: "1px solid #2a2a35",
					overflow: "auto",
					padding: "8px 0",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "4px 12px 8px",
					}}
				>
					<span style={{ fontSize: 12, color: "#888" }}>
						{files.length} files
					</span>
					<button
						type="button"
						onClick={fetchFiles}
						style={{
							all: "unset",
							fontSize: 11,
							color: "#58a6ff",
							cursor: "pointer",
						}}
					>
						refresh
					</button>
				</div>
				<FileTree
					nodes={tree}
					depth={0}
					selectedPath={selectedFile}
					onSelect={setSelectedFile}
				/>
			</div>
			<div style={{ flex: 1, overflow: "auto" }}>
				{loading ? (
					<div style={{ padding: 24, color: "#888", fontSize: 13 }}>
						Loading...
					</div>
				) : selectedFile ? (
					<DiffContent hunks={hunks} />
				) : (
					<div style={{ padding: 24, color: "#555", fontSize: 13 }}>
						ファイルを選択してください
					</div>
				)}
			</div>
		</div>
	);
}
