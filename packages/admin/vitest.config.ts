import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { testProjects } from "@shivaedev/quality/adapters/testProjects.ts";

const SERVER_CONDITIONS = ["@shivaedev/source", "node", "development|production"];

export default defineConfig({
	// Vitest's own environment loads the global setup, which runs @shivaedev/build from source.
	environments: { "__vitest__": { resolve: { conditions: SERVER_CONDITIONS } } },
	resolve: { conditions: ["@shivaedev/source", "module", "browser", "development|production"] },
	ssr: { resolve: { conditions: SERVER_CONDITIONS } },
	test: { ...testProjects(), globalSetup: [fileURLToPath(import.meta.resolve("@shivaedev/build/adapters/vitest/setup.ts"))] },
});
