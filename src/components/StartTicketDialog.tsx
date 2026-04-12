import { useState } from "react";
import { useTheme } from "../lib/ThemeContext";
import type { Directory } from "../types/directory";
import type { Ticket } from "../types/ticket";

type Props = {
	ticket: Ticket;
	directories: Directory[];
	onConfirm: (
		ticketId: string,
		directoryId: string,
		addDirectoryIds: string[],
	) => void;
	onCancel: () => void;
};

export function StartTicketDialog({
	ticket,
	directories,
	onConfirm,
	onCancel,
}: Props) {
	const { theme } = useTheme();
	const [selectedDirId, setSelectedDirId] = useState(directories[0]?.id ?? "");
	const [addDirIds, setAddDirIds] = useState<string[]>([]);

	const toggleAddDir = (id: string) => {
		setAddDirIds((prev) =>
			prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
		);
	};

	const otherDirs = directories.filter((d) => d.id !== selectedDirId);

	return (
		/* biome-ignore lint/a11y/noStaticElementInteractions: modal overlay */
		<div
			style={{
				position: "fixed",
				inset: 0,
				backgroundColor: "rgba(0,0,0,0.6)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				zIndex: 100,
			}}
			onClick={onCancel}
			onKeyDown={() => {}}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: modal content */}
			<div
				onClick={(e) => e.stopPropagation()}
				onKeyDown={() => {}}
				style={{
					backgroundColor: theme.bgCard,
					border: `1px solid ${theme.border}`,
					borderRadius: 10,
					padding: 24,
					minWidth: 360,
					maxWidth: 480,
					color: theme.text,
				}}
			>
				<h3 style={{ margin: "0 0 16px", fontSize: 16 }}>チケットを開始</h3>
				<p
					style={{
						fontSize: 13,
						color: theme.textMuted,
						margin: "0 0 16px",
						wordBreak: "break-word",
					}}
				>
					{ticket.title}
				</p>

				<div style={{ marginBottom: 16 }}>
					<label
						style={{
							display: "block",
							fontSize: 13,
							color: theme.textLabel,
							marginBottom: 6,
						}}
					>
						作業ディレクトリ
						<select
							value={selectedDirId}
							onChange={(e) => {
								setSelectedDirId(e.target.value);
								setAddDirIds((prev) =>
									prev.filter((id) => id !== e.target.value),
								);
							}}
							style={{
								display: "block",
								width: "100%",
								marginTop: 4,
								padding: "6px 8px",
								fontSize: 13,
								backgroundColor: theme.bgInput,
								color: theme.text,
								border: `1px solid ${theme.border}`,
								borderRadius: 4,
							}}
						>
							{directories.map((d) => (
								<option key={d.id} value={d.id}>
									{d.name} — {d.path}
								</option>
							))}
						</select>
					</label>
				</div>

				{otherDirs.length > 0 && (
					<div style={{ marginBottom: 16 }}>
						<span
							style={{
								display: "block",
								fontSize: 13,
								color: theme.textLabel,
								marginBottom: 6,
							}}
						>
							追加ディレクトリ (--add-dir)
						</span>
						{otherDirs.map((d) => (
							<label
								key={d.id}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 8,
									fontSize: 13,
									color: theme.textLabel,
									padding: "3px 0",
									cursor: "pointer",
								}}
							>
								<input
									type="checkbox"
									checked={addDirIds.includes(d.id)}
									onChange={() => toggleAddDir(d.id)}
								/>
								{d.name}
								<span
									style={{
										color: theme.textDim,
										fontFamily: "monospace",
										fontSize: 11,
									}}
								>
									{d.path}
								</span>
							</label>
						))}
					</div>
				)}

				<div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
					<button
						type="button"
						onClick={onCancel}
						style={{
							padding: "6px 14px",
							fontSize: 13,
							backgroundColor: "transparent",
							color: theme.textMuted,
							border: `1px solid ${theme.border}`,
							borderRadius: 4,
							cursor: "pointer",
						}}
					>
						キャンセル
					</button>
					<button
						type="button"
						onClick={() =>
							selectedDirId && onConfirm(ticket.id, selectedDirId, addDirIds)
						}
						disabled={!selectedDirId}
						style={{
							padding: "6px 14px",
							fontSize: 13,
							backgroundColor: theme.accent,
							color: "#fff",
							border: "none",
							borderRadius: 4,
							cursor: selectedDirId ? "pointer" : "not-allowed",
							opacity: selectedDirId ? 1 : 0.5,
						}}
					>
						開始
					</button>
				</div>
			</div>
		</div>
	);
}
