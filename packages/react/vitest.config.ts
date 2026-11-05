import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { testProjects } from "@shivaedev/test-kits/quality/adapters/testProjects.ts";

const test = testProjects();
for (const project of test.projects ?? []) {
	if (typeof project === "object" && "test" in project && project.test?.name === "dom") {
		project.test.environment = fileURLToPath(import.meta.resolve("@shivaedev/test-story/server/adapters/domEnvironment.config.ts"));
	}
}

export default defineConfig({
	resolve: { conditions: ["@shivaedev/source", "module", "browser", "development|production"] },
	ssr: { resolve: { conditions: ["@shivaedev/source", "node", "development|production"] } },
	test,
});
