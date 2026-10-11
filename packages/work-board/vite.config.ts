import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	build: {
		cssCodeSplit: false,
		emptyOutDir: false,
		outDir: "assets",
		rolldownOptions: {
			input: "src/browser/react/entry.tsx",
			output: { assetFileNames: "react.[ext]", entryFileNames: "react.js" },
		},
	},
	plugins: [tailwindcss(), react()],
	resolve: { conditions: ["source"], tsconfigPaths: true },
});
