import { expect } from "vitest";
import { planning } from "#ci/test-support/planning.ts";
import { vitestWorkspace } from "#ci/test-support/vitestWorkspace.ts";

for (const measured of [false, true]) {
	for (const count of [1, 2, 8]) {
		planning.it(
			`sequences every project and new file once across ${count} shards with timings ${measured}`,
			[vitestWorkspace],
			function* ({ withTimings, sequence, testNames }) {
				if (measured) {
					withTimings({
						runId: "42",
						sha: "main-sha",
						timings: [
							{ durationMs: 20_000, name: "fixture:unit:heavy.test.ts" },
							{ durationMs: 15_000, name: "fixture:dom:shared.test.ts" },
							{ durationMs: 5000, name: "fixture:unit:shared.test.ts" },
						],
					});
				}
				const names = yield* testNames();
				expect(names).toEqual([
					"fixture:dom:shared.test.ts",
					"fixture:unit:heavy.test.ts",
					"fixture:unit:new.test.ts",
					"fixture:unit:shared.test.ts",
					"fixture:unit:small.test.ts",
				]);
				const groups: string[][] = [];
				for (let index = 1; index <= count; index += 1) {
					const group = yield* sequence(count, index);
					expect(group).toEqual(yield* sequence(count, index, true));
					groups.push(group);
				}
				expect(groups.flat().sort()).toEqual(names);
				if (measured && count === 2) {
					expect(groups).toEqual([
						["fixture:unit:heavy.test.ts", "fixture:unit:new.test.ts"],
						["fixture:dom:shared.test.ts", "fixture:unit:shared.test.ts", "fixture:unit:small.test.ts"],
					]);
				}
			},
		);
	}
}
