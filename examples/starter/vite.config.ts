import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss(), react()],
	resolve: { conditions: ["source"], tsconfigPaths: true },
	server: {
		host: "127.0.0.1",
		port: 5173,
		proxy: {
			"/api/auth": { changeOrigin: false, target: "http://127.0.0.1:3000" },
			"/rpc": { changeOrigin: false, target: "http://127.0.0.1:3000" },
		},
		strictPort: true,
	},
});
