import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	server: {
		port: 24511,
		proxy: {
			"/api": "http://localhost:24510",
			"/ws": {
				target: "ws://localhost:24510",
				ws: true,
			},
		},
	},
});
