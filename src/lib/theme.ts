export type Theme = {
	bg: string;
	bgCard: string;
	bgInput: string;
	bgHover: string;
	border: string;
	borderActive: string;
	text: string;
	textMuted: string;
	textDim: string;
	textLabel: string;
	accent: string;
	green: string;
	greenBorder: string;
	yellow: string;
	yellowBorder: string;
	red: string;
	blue: string;
	link: string;
	tag: string;
	tagBg: string;
	tagBorder: string;
	shadow: string;
	columnTodo: { bg: string; border: string; badge: string };
	columnInProgress: { bg: string; border: string; badge: string };
	columnDone: { bg: string; border: string; badge: string };
};

export const darkTheme: Theme = {
	bg: "#121218",
	bgCard: "#1e1e2e",
	bgInput: "#16161e",
	bgHover: "#2a2a40",
	border: "#2a2a35",
	borderActive: "#3a3a60",
	text: "#ddd",
	textMuted: "#888",
	textDim: "#555",
	textLabel: "#aaa",
	accent: "#2563eb",
	green: "#43a047",
	greenBorder: "#2e7d32",
	yellow: "#c68a1a",
	yellowBorder: "#3d3520",
	red: "#f85149",
	blue: "#58a6ff",
	link: "#6c8ebf",
	tag: "#8b9dc3",
	tagBg: "#2a2a40",
	tagBorder: "#3a3a50",
	shadow: "rgba(0,0,0,0.5)",
	columnTodo: { bg: "#1c1c28", border: "#2a2a35", badge: "#6c757d" },
	columnInProgress: { bg: "#1f1c14", border: "#3d3520", badge: "#c68a1a" },
	columnDone: { bg: "#141f16", border: "#1e3524", badge: "#2e7d32" },
};

export const lightTheme: Theme = {
	bg: "#f5f5f7",
	bgCard: "#ffffff",
	bgInput: "#f0f0f2",
	bgHover: "#e8e8ec",
	border: "#d0d0d5",
	borderActive: "#a0a0b0",
	text: "#1a1a1a",
	textMuted: "#666",
	textDim: "#999",
	textLabel: "#555",
	accent: "#2563eb",
	green: "#2e7d32",
	greenBorder: "#43a047",
	yellow: "#e65100",
	yellowBorder: "#ff9800",
	red: "#d32f2f",
	blue: "#1565c0",
	link: "#1976d2",
	tag: "#37474f",
	tagBg: "#e3e8ef",
	tagBorder: "#cfd8dc",
	shadow: "rgba(0,0,0,0.12)",
	columnTodo: { bg: "#f8f8fa", border: "#d0d0d5", badge: "#78909c" },
	columnInProgress: { bg: "#fff8e1", border: "#ffe082", badge: "#f9a825" },
	columnDone: { bg: "#e8f5e9", border: "#a5d6a7", badge: "#43a047" },
};
