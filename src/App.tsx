import { useCallback, useRef, useState } from "react";
import { Settings } from "./components/Settings";
import { Terminal } from "./components/Terminal";
import { TodoApp } from "./components/TodoApp";
import { useBrowserNotifications } from "./lib/useBrowserNotifications";
import { useTheme } from "./lib/ThemeContext";

type Page = "todo" | "settings";

export function App() {
	const { theme, mode, toggle } = useTheme();
	const containerRef = useRef<HTMLDivElement>(null);
	const [leftWidthPercent, setLeftWidthPercent] = useState(33);
	const dragging = useRef(false);
	const [page, setPage] = useState<Page>("todo");

	useBrowserNotifications();

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
			style={{ height: "100vh", display: "flex", backgroundColor: theme.bg }}
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
						backgroundColor: theme.border,
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
						borderBottom: `1px solid ${theme.border}`,
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
									page === key
										? `2px solid ${theme.accent}`
										: "2px solid transparent",
								backgroundColor: "transparent",
								color: page === key ? theme.text : theme.textDim,
								fontWeight: page === key ? 600 : 400,
								cursor: "pointer",
							}}
						>
							{label}
						</button>
					))}
					{/* biome-ignore lint/a11y/noStaticElementInteractions: theme toggle */}
					<div
						onClick={toggle}
						onKeyDown={() => {}}
						title={
							mode === "dark"
								? "ライトモードに切り替え"
								: "ダークモードに切り替え"
						}
						style={{
							marginLeft: "auto",
							width: 44,
							height: 22,
							borderRadius: 11,
							backgroundColor: mode === "dark" ? theme.border : theme.accent,
							cursor: "pointer",
							position: "relative",
							transition: "background-color 0.2s",
						}}
					>
						<div
							style={{
								position: "absolute",
								top: 2,
								left: mode === "dark" ? 2 : 24,
								width: 18,
								height: 18,
								borderRadius: "50%",
								backgroundColor: "#fff",
								transition: "left 0.2s",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								fontSize: 10,
							}}
						>
							{mode === "dark" ? "🌙" : "☀️"}
						</div>
					</div>
				</nav>
				<div style={{ flex: 1, overflow: "auto" }}>
					{page === "todo" ? <TodoApp /> : <Settings />}
				</div>
			</div>
		</div>
	);
}
