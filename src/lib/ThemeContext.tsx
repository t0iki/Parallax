import { createContext, useContext, useEffect, useState } from "react";
import { darkTheme, lightTheme, type Theme } from "./theme";

type ThemeMode = "dark" | "light";

const ThemeContext = createContext<{
	theme: Theme;
	mode: ThemeMode;
	toggle: () => void;
}>({
	theme: darkTheme,
	mode: "dark",
	toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [mode, setMode] = useState<ThemeMode>(() => {
		const saved = localStorage.getItem("plx-theme");
		return saved === "light" ? "light" : "dark";
	});

	const theme = mode === "dark" ? darkTheme : lightTheme;

	useEffect(() => {
		localStorage.setItem("plx-theme", mode);
		document.body.style.backgroundColor = theme.bg;
	}, [mode, theme.bg]);

	const toggle = () => setMode((m) => (m === "dark" ? "light" : "dark"));

	return (
		<ThemeContext.Provider value={{ theme, mode, toggle }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	return useContext(ThemeContext);
}
