import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { testProjects } from "@shivaedev/test-kits/quality/adapters/testProjects.ts";

export default defineConfig({
	resolve: {
		alias: {
			"#baseline-workspace": fileURLToPath(new URL("../../script/quality/test-support/baselineWorkspace.ts", import.meta.url)),
			"#effect-policy-story": fileURLToPath(new URL("../../script/quality/test-support/effectPolicyStory.ts", import.meta.url)),
			"#exports-story": fileURLToPath(new URL("../../script/quality/test-support/exportsStory.ts", import.meta.url)),
			"#rule-story": fileURLToPath(new URL("../../script/quality/test-support/ruleKit.ts", import.meta.url)),
		},
		conditions: ["@shivaedev/source", "module", "browser", "development|production"],
	},
	ssr: { resolve: { conditions: ["@shivaedev/source", "node", "development|production"] } },
	test: testProjects(),
});
