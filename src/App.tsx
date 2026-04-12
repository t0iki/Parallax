import { useCallback, useRef, useState } from "react";
import { Settings } from "./Settings";
import { Terminal } from "./Terminal";
import { TodoApp } from "./TodoApp";

type Page = "todo" | "settings";

export function App() {
	const containerRef = useRef<HTMLDivElement>(null);
	const [leftWidthPercent, setLeftWidthPercent] = useState(33);
	const dragging = useRef(false);
	const [page, setPage] = useState<Page>("todo");

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		dragging.current = true;

		const onMouseMove = (ev: MouseEvent) => {
			if (!dragging.current || !containerRef.current) return;
			const rect = containerRef.current.getBoundingClientRect();
			const percent = ((ev.clientX - rect.left) / rect.width) * 100;
			setLeftWidthPercent(Math.min(Math.max(percent, 10), 90));
		};

		const onMouseUp = () => {
			dragging.current = false;
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};

		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
	}, []);

	return (
		<div
			ref={containerRef}
			style={{ height: "100vh", display: "flex", backgroundColor: "#121218" }}
		>
			<div style={{ width: `${leftWidthPercent}%`, minWidth: 0 }}>
				<Terminal />
			</div>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: drag resize handle */}
			<div
				onMouseDown={handleMouseDown}
				style={{
					width: 6,
					cursor: "col-resize",
					backgroundColor: "transparent",
					flexShrink: 0,
					position: "relative",
				}}
			>
				<div
					style={{
						position: "absolute",
						left: 2,
						top: 0,
						bottom: 0,
						width: 1,
						backgroundColor: "#2a2a35",
					}}
				/>
			</div>
			<div
				style={{
					flex: 1,
					minWidth: 0,
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
				}}
			>
				<nav
					style={{
						display: "flex",
						alignItems: "center",
						padding: "0 16px",
						borderBottom: "1px solid #2a2a35",
						flexShrink: 0,
					}}
				>
					{(
						[
							["todo", "Board"],
							["settings", "Settings"],
						] as const
					).map(([key, label]) => (
						<button
							key={key}
							type="button"
							onClick={() => setPage(key)}
							style={{
								padding: "10px 16px",
								fontSize: 13,
								border: "none",
								borderBottom:
									page === key ? "2px solid #2563eb" : "2px solid transparent",
								backgroundColor: "transparent",
								color: page === key ? "#ccc" : "#666",
								fontWeight: page === key ? 600 : 400,
								cursor: "pointer",
							}}
						>
							{label}
						</button>
					))}
				</nav>
				<div style={{ flex: 1, overflow: "auto" }}>
					{page === "todo" ? <TodoApp /> : <Settings />}
				</div>
			</div>
		</div>
	);
}
