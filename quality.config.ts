import { defineConfig } from "@shivaedev/quality/config.ts";
import { biomeOverrideDeclarations } from "#quality/biomeOverrideDeclarations.ts";

export default defineConfig({
	rules: {
		"imports/resolvable": { options: { generated: ["packages/effect-changes-prisma/src/test-support/generated"] } },
		"suppressions/biome-overrides": {
			options: {
				declared: biomeOverrideDeclarations,
			},
		},
	},
	sources: ["packages", "examples", "script"],
});
