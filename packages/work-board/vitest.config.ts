import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { testProjects } from "@shivaedev/quality/adapters/testProjects.ts";

export default defineConfig({
	resolve: { conditions: ["source", "module", "browser", "development|production"] },
	ssr: { resolve: { conditions: ["source", "node", "development|production"] } },
	test: {
		...testProjects(),
		projects: testProjects().projects?.map((project) =>
			typeof project === "object" && "test" in project && project.test?.name === "dom"
				? {
						...project,
						test: { ...project.test, environment: fileURLToPath(import.meta.resolve("@shivaedev/test-story/server/domEnvironment.config.ts")) },
					}
				: project,
		),
	},
});
