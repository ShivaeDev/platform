import type { ViteUserConfig } from "vitest/config";
import { type TestProjectsOptions, testProjects } from "#adapters/testProjects.ts";

export function appTestConfig(conditions: string[] = [], options: TestProjectsOptions = {}): ViteUserConfig {
	return {
		resolve: { conditions: [...conditions, "module", "browser", "development|production"] },
		ssr: { resolve: { conditions: [...conditions, "node", "development|production"] } },
		test: { ...testProjects(options), server: { deps: { inline: [/^@shivaedev\//u] } } },
	};
}
