import { defineConfig } from "vitest/config";
import { testProjects } from "@shivaedev/quality/vitest.ts";

export default defineConfig({
	resolve: { conditions: ["source"] },
	test: testProjects(),
});
