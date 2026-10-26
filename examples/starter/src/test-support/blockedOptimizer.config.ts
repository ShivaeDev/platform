import { writeSync } from "node:fs";
import process from "node:process";
import { defineConfig } from "vite";

process.on("exit", () => {
	writeSync(1, "development process exited\n");
	writeSync(2, "development stderr ended\n");
});

export default defineConfig({
	cacheDir: "node_modules/.vite-blocked-optimizer",
	optimizeDeps: {
		entries: [],
		force: true,
		include: ["react"],
		rolldownOptions: {
			plugins: [
				{
					async buildStart() {
						writeSync(1, "dependency optimizer blocked\n");
						await new Promise(() => undefined);
					},
					name: "blocked-optimizer",
				},
			],
		},
	},
	plugins: [
		{
			closeServer: () => {
				writeSync(1, "development server closed\n");
			},
			name: "observe-server-close",
		},
	],
});
