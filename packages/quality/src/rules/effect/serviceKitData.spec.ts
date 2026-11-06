import { expect } from "@effect/vitest";
import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { serviceKitDataFiles } from "#test/serviceKitFiles.ts";

for (const runtime of [false, true]) {
	ruleStory.it(
		`service parameters ${runtime ? "rejects a runtime service shape" : "accepts plain data also used as kit state"}`,
		[effectResolves(), repositoryHas(...serviceKitDataFiles(runtime))],
		function* ({ check }) {
			expect(yield* check(serviceParameters)).toEqual(runtime ? [expect.objectContaining({ file: "src/state.ts" })] : []);
		},
	);
}
