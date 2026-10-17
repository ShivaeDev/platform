import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { testProjects } from "@shivaedev/quality/testProjects.ts";
import { genreTags } from "#genreTags.ts";

const test = testProjects();
for (const project of test.projects ?? []) {
	if (typeof project === "object" && "test" in project && project.test?.name === "dom") {
		project.test.environment = fileURLToPath(new URL("./src/server/domEnvironment.config.ts", import.meta.url));
	}
}

export default defineConfig({
	resolve: { conditions: ["source", "module", "browser", "development|production"] },
	ssr: { resolve: { conditions: ["source", "node", "development|production"] } },
	test: { ...test, tags: genreTags("bakery", "mill") },
});
