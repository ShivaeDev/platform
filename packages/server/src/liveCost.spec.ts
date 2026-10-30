import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { liveCost, viewers } from "#test/live-cost/story.ts";

for (const queries of [1, 8]) {
	liveCost.it(
		`one shared-bucket write refreshes all ${12 * queries} queries across twelve sockets within the session and read budgets`,
		[viewers(12, queries)],
		function* ({ cost, edit, initialResults, recordBaseline, results }) {
			expect(initialResults()).toEqual(Array.from({ length: 12 }, () => Array.from({ length: queries }, () => "Original")));
			yield* recordBaseline();

			yield* edit("Changed");

			yield* outcomes({
				"query results": [results(), Array.from({ length: 12 }, () => Array.from({ length: queries }, () => "Changed"))],
				"session and read cost": [Effect.sync(cost), { checks: 36 * queries, lookups: 12 + 12 * queries, reruns: 12 * queries }],
			});
		},
	);
}
