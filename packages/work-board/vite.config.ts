import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	base: "/_board/",
	build: {
		cssCodeSplit: false,
		emptyOutDir: false,
		outDir: "assets",
		rolldownOptions: {
			external: ["#client/entry.ts", "mermaid"],
			input: "src/client/react/entry.tsx",
			output: {
				assetFileNames: "react.[ext]",
				chunkFileNames: "react-assets/[name]-[hash].js",
				entryFileNames: "react.js",
				paths: { "#client/entry.ts": "/_board/native.js", mermaid: "/_board/mermaid/mermaid.esm.min.mjs" },
			},
		},
	},
	define: { "import.meta.resolve": "undefined" },
	plugins: [tailwindcss(), react()],
	resolve: { conditions: ["source"], tsconfigPaths: true },
});
