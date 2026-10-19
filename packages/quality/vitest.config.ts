import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { testProjects } from "#testProjects.ts";

export default defineConfig({
	resolve: {
		alias: { "#exports-story": fileURLToPath(new URL("../../script/quality/test-support/exportsStory.ts", import.meta.url)) },
		conditions: ["source", "module", "browser", "development|production"],
	},
	ssr: { resolve: { conditions: ["source", "node", "development|production"] } },
	test: testProjects(),
});
