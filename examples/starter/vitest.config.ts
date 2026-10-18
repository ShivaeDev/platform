import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { testProjects } from "@shivaedev/quality/testProjects.ts";

const test = testProjects();
for (const project of test.projects ?? []) {
	if (typeof project === "object" && "test" in project && project.test?.name === "dom") {
		project.test.environment = fileURLToPath(import.meta.resolve("@shivaedev/test-story/domEnvironment.config.ts"));
	}
}

export default defineConfig({
	resolve: { conditions: ["source", "module", "browser", "development|production"] },
	ssr: { resolve: { conditions: ["source", "node", "development|production"] } },
	test: { ...test, server: { deps: { inline: ["@shivaedev/platform", "better-auth"] } } },
});
