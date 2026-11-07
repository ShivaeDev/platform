import { expect } from "@effect/vitest";
import { serviceModel } from "#rules/effect/serviceModel.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { ownedServiceFiles } from "#test/ownedServiceFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { serviceResolves } from "#test/serviceModelFiles.ts";

for (const captured of [false, true]) {
	ruleStory.it(
		`service model ${captured ? "rejects an environment dependency beside" : "accepts"} owned scopes, acquired handles, maps and Ref closures`,
		[effectResolves(), serviceResolves(), repositoryHas(...ownedServiceFiles(captured))],
		function* ({ check }) {
			const findings = yield* check(serviceModel);

			expect(findings).toEqual(
				captured ? [expect.objectContaining({ message: expect.stringContaining("Initializer state carries a dependency.") })] : [],
			);
		},
	);
}
