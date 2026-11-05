import { defineConfig } from "vitest/config";
import { type TestProjectsOptions, testProjects } from "#quality/adapters/testProjects.ts";

export function appTestConfig(conditions: string[] = [], options: TestProjectsOptions = {}) {
	return defineConfig({
		resolve: { conditions: [...conditions, "module", "browser", "development|production"] },
		ssr: { resolve: { conditions: [...conditions, "node", "development|production"] } },
		test: { ...testProjects(options), server: { deps: { inline: [/^@shivaedev\//u] } } },
	});
}
