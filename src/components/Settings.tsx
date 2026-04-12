import { useEffect, useState } from "react";
import type { Directory } from "../types/directory";

const INPUT_STYLE: React.CSSProperties = {
	padding: "6px 8px",
	fontSize: 13,
	border: "1px solid #2a2a35",
	borderRadius: 4,
	backgroundColor: "#16161e",
	color: "#ccc",
};

export function Settings() {
	const [directories, setDirectories] = useState<Directory[]>([]);
	const [name, setName] = useState("");
	const [dirPath, setDirPath] = useState("");
	const [mainBranch, setMainBranch] = useState("main");
	const [branchTemplate, setBranchTemplate] = useState("{title}");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");
	const [editPath, setEditPath] = useState("");
	const [editMainBranch, setEditMainBranch] = useState("");
	const [editBranchTemplate, setEditBranchTemplate] = useState("");

	useEffect(() => {
		fetch("/api/directories")
			.then((res) => res.json())
			.then(setDirectories);
	}, []);

	const addDirectory = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmedName = name.trim();
		const trimmedPath = dirPath.trim();
		if (!trimmedName || !trimmedPath) return;

		const dir: Directory = {
			id: crypto.randomUUID(),
			name: trimmedName,
			path: trimmedPath,
			mainBranch: mainBranch.trim() || "main",
			branchTemplate: branchTemplate.trim() || "{title}",
			createdAt: Date.now(),
		};
		setDirectories((prev) => [...prev, dir]);
		setName("");
		setDirPath("");
		setMainBranch("main");
		setBranchTemplate("{title}");
		await fetch("/api/directories", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(dir),
		});
	};

	const startEdit = (dir: Directory) => {
		setEditingId(dir.id);
		setEditName(dir.name);
		setEditPath(dir.path);
		setEditMainBranch(dir.mainBranch);
		setEditBranchTemplate(dir.branchTemplate);
	};

	const saveEdit = async (id: string) => {
		const trimmedName = editName.trim();
		const trimmedPath = editPath.trim();
		const trimmedBranch = editMainBranch.trim() || "main";
		const trimmedTemplate = editBranchTemplate.trim() || "{title}";
		if (!trimmedName || !trimmedPath) return;

		setDirectories((prev) =>
			prev.map((d) =>
				d.id === id
					? {
							...d,
							name: trimmedName,
							path: trimmedPath,
							mainBranch: trimmedBranch,
							branchTemplate: trimmedTemplate,
						}
					: d,
			),
		);
		setEditingId(null);
		await fetch(`/api/directories/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: trimmedName,
				path: trimmedPath,
				mainBranch: trimmedBranch,
				branchTemplate: trimmedTemplate,
			}),
		});
	};

	const deleteDirectory = async (id: string) => {
		setDirectories((prev) => prev.filter((d) => d.id !== id));
		await fetch(`/api/directories/${id}`, { method: "DELETE" });
	};

	return (
		<div
			style={{
				height: "100%",
				overflow: "auto",
				padding: 24,
				color: "#ddd",
			}}
		>
			<h2 style={{ fontSize: 18, margin: "0 0 20px", color: "#bbb" }}>設定</h2>

			<section>
				<h3 style={{ fontSize: 15, margin: "0 0 12px", color: "#999" }}>
					作業ディレクトリ
				</h3>

				<form
					onSubmit={addDirectory}
					style={{ display: "flex", gap: 8, marginBottom: 16 }}
				>
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="名前"
						style={{ ...INPUT_STYLE, width: 100 }}
					/>
					<input
						type="text"
						value={dirPath}
						onChange={(e) => setDirPath(e.target.value)}
						placeholder="パス (例: /Users/you/project)"
						style={{ ...INPUT_STYLE, flex: 1 }}
					/>
					<input
						type="text"
						value={mainBranch}
						onChange={(e) => setMainBranch(e.target.value)}
						placeholder="main"
						style={{ ...INPUT_STYLE, width: 80 }}
					/>
					<input
						type="text"
						value={branchTemplate}
						onChange={(e) => setBranchTemplate(e.target.value)}
						placeholder="{title}"
						title="ブランチ名テンプレート: {title}, {id} が使えます"
						style={{ ...INPUT_STYLE, width: 120 }}
					/>
					<button
						type="submit"
						style={{
							padding: "6px 14px",
							fontSize: 13,
							backgroundColor: "#2563eb",
							color: "#fff",
							border: "none",
							borderRadius: 4,
							cursor: "pointer",
							whiteSpace: "nowrap",
						}}
					>
						追加
					</button>
				</form>

				{directories.length === 0 ? (
					<p style={{ color: "#555", fontSize: 13 }}>
						ディレクトリが登録されていません
					</p>
				) : (
					<ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
						{directories.map((dir) => (
							<li
								key={dir.id}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 8,
									padding: "8px 12px",
									marginBottom: 4,
									backgroundColor: "#1e1e2e",
									borderRadius: 6,
									border: "1px solid #2a2a35",
								}}
							>
								{editingId === dir.id ? (
									<>
										<input
											type="text"
											value={editName}
											onChange={(e) => setEditName(e.target.value)}
											style={{ ...INPUT_STYLE, width: 80 }}
										/>
										<input
											type="text"
											value={editPath}
											onChange={(e) => setEditPath(e.target.value)}
											style={{ ...INPUT_STYLE, flex: 1 }}
										/>
										<input
											type="text"
											value={editMainBranch}
											onChange={(e) => setEditMainBranch(e.target.value)}
											placeholder="main"
											style={{ ...INPUT_STYLE, width: 80 }}
										/>
										<input
											type="text"
											value={editBranchTemplate}
											onChange={(e) => setEditBranchTemplate(e.target.value)}
											placeholder="{title}"
											style={{ ...INPUT_STYLE, width: 120 }}
										/>
										<button
											type="button"
											onClick={() => saveEdit(dir.id)}
											style={{
												padding: "4px 10px",
												fontSize: 12,
												backgroundColor: "#2563eb",
												color: "#fff",
												border: "none",
												borderRadius: 4,
												cursor: "pointer",
											}}
										>
											保存
										</button>
										<button
											type="button"
											onClick={() => setEditingId(null)}
											style={{
												padding: "4px 10px",
												fontSize: 12,
												backgroundColor: "transparent",
												color: "#888",
												border: "1px solid #333",
												borderRadius: 4,
												cursor: "pointer",
											}}
										>
											取消
										</button>
									</>
								) : (
									<>
										<span
											style={{
												fontSize: 13,
												fontWeight: 600,
												color: "#ccc",
												minWidth: 80,
											}}
										>
											{dir.name}
										</span>
										<span
											style={{
												flex: 1,
												fontSize: 13,
												color: "#888",
												fontFamily: "monospace",
											}}
										>
											{dir.path}
										</span>
										<span
											style={{
												fontSize: 12,
												color: "#6c8ebf",
												fontFamily: "monospace",
											}}
										>
											{dir.mainBranch}
										</span>
										<span
											style={{
												fontSize: 11,
												color: "#888",
												fontFamily: "monospace",
											}}
										>
											{dir.branchTemplate}
										</span>
										<button
											type="button"
											onClick={() => startEdit(dir)}
											style={{
												padding: "3px 8px",
												fontSize: 11,
												backgroundColor: "transparent",
												color: "#888",
												border: "1px solid #333",
												borderRadius: 4,
												cursor: "pointer",
											}}
										>
											編集
										</button>
										<button
											type="button"
											onClick={() => deleteDirectory(dir.id)}
											style={{
												padding: "3px 8px",
												fontSize: 11,
												backgroundColor: "transparent",
												color: "#666",
												border: "1px solid #333",
												borderRadius: 4,
												cursor: "pointer",
											}}
										>
											削除
										</button>
									</>
								)}
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
