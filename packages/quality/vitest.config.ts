import { defineConfig } from "vitest/config";
import { testProjects } from "./src/vitest.ts";

export default defineConfig({
	resolve: { conditions: ["source", "module", "browser", "development|production"] },
	ssr: { resolve: { conditions: ["source", "node", "development|production"] } },
	test: testProjects(),
});
