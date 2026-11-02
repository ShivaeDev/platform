import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { vitestRun } from "#test/vitestRun.ts";

for (const clock of ["live", "test"] as const) {
	vitestRun.it(`TestConsole captures output in a fresh console for each test under the ${clock} clock`, [], function* ({ lifecycle, runs }) {
		yield* runs(`the first console test under the ${clock} clock`, `the next console test under the ${clock} clock`);

		expect(yield* lifecycle()).toEqual([
			"first starts with []",
			`first captures ["first's output"]`,
			"next starts with []",
			`next captures ["next's output"]`,
		]);
	});
}

for (const tester of ["fixture", "it.effect", "it.live"] as const) {
	for (const form of ["Effect", "generator"] as const) {
		vitestRun.it(`${tester}.each finalizes each ${form} table body before the next case`, [], function* ({ lifecycle, runs }) {
			yield* runs(`${tester} ${form} table case alpha`, `${tester} ${form} table case beta`);

			expect(yield* lifecycle()).toEqual([
				"the body received alpha",
				"released alpha's resource",
				"the body received beta",
				"released beta's resource",
			]);
		});
	}
}

vitestRun.it("the nested runner reports an unhandled rejection even when the body passes", [], function* ({ outcome, runs, unhandledErrors }) {
	yield* runs("a body with an unhandled rejection");

	yield* outcomes([
		["body outcome", () => outcome(), "passed"],
		["unhandled errors", () => unhandledErrors(), [expect.objectContaining({ message: "a rejection escaped the body" })]],
	]);
});
