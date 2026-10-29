import { defineConfig } from "vitest/config";
import { type TestProjectsOptions, testProjects } from "#testProjects.ts";

export function appTestConfig(conditions: string[] = [], options: Pick<TestProjectsOptions, "coverage"> = {}) {
	return defineConfig({
		resolve: { conditions: [...conditions, "module", "browser", "development|production"] },
		ssr: { resolve: { conditions: [...conditions, "node", "development|production"] } },
		test: { ...testProjects(options), server: { deps: { inline: [/^@shivaedev\//u] } } },
	});
}
