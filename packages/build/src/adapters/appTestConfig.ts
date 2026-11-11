import { fileURLToPath } from "node:url";
import type { ViteUserConfig } from "vitest/config";
import { type TestProjectsOptions, testProjects } from "@shivaedev/quality/adapters/testProjects.ts";

export function appTestConfig(conditions: string[] = [], options: TestProjectsOptions = {}): ViteUserConfig {
	const server = { resolve: { conditions: [...conditions, "node", "development|production"] } };
	return {
		// Vitest loads the global setup in its own environment, which needs the application's conditions to find the generator's sources.
		environments: { "__vitest__": server },
		resolve: { conditions: [...conditions, "module", "browser", "development|production"] },
		ssr: server,
		test: {
			...testProjects(options),
			globalSetup: [fileURLToPath(import.meta.resolve("#adapters/vitest/setup.ts"))],
			server: { deps: { inline: [/^@shivaedev\//u] } },
		},
	};
}
