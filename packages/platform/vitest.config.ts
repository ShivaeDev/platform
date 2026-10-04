import { defineConfig } from "vitest/config";
import { testProjects } from "@shivaedev/quality/vitest";

export default defineConfig({
	resolve: { conditions: ["source", "module", "browser", "development|production"] },
	ssr: { resolve: { conditions: ["source", "module", "node", "development|production"] } },
	test: testProjects(),
});
