import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	build: {
		cssCodeSplit: false,
		emptyOutDir: false,
		outDir: "assets",
		rolldownOptions: {
			external: ["#browser/entry.ts"],
			input: "src/browser/react/entry.tsx",
			output: { assetFileNames: "react.[ext]", entryFileNames: "react.js", paths: { "#browser/entry.ts": "/_board/native.js" } },
		},
	},
	plugins: [tailwindcss(), react()],
	resolve: { conditions: ["source"], tsconfigPaths: true },
});
