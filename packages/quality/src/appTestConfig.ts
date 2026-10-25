import { defineConfig } from "vitest/config";
import { testProjects } from "#testProjects.ts";

export function appTestConfig(conditions: string[] = []) {
	return defineConfig({
		resolve: { conditions: [...conditions, "module", "browser", "development|production"] },
		ssr: { resolve: { conditions: [...conditions, "node", "development|production"] } },
		test: { ...testProjects(), server: { deps: { inline: ["@shivaedev/platform", "better-auth"] } } },
	});
}
