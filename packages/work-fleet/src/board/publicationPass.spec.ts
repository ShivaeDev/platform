import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardReadStory, hasBoardItems } from "#test/boardReadStory.ts";

boardReadStory.it(
	"status publications deferred during a pass wait for the pass to end",
	[hasBoardItems(1)],
	function* ({ deferStatus, duringOnePass, publications, publishedStatus }) {
		yield* duringOnePass(
			Effect.gen(function* () {
				yield* deferStatus();
				yield* deferStatus();

				yield* outcomes([
					["publications", () => publications(), []],
					["published status", () => publishedStatus(), undefined],
				]);
			}),
		);
	},
);

boardReadStory.it(
	"two status publications deferred in a failed pass publish once when it ends",
	[hasBoardItems(1)],
	function* ({ deferStatus, duringOnePass, publications, publishedStatus }) {
		yield* duringOnePass(Effect.andThen(Effect.all([deferStatus(), deferStatus()]), Effect.fail("stopped"))).pipe(Effect.ignore);

		yield* outcomes([
			["publications", () => publications(), ["fleet/status.md"]],
			["published status", () => publishedStatus(), expect.stringContaining("item.0")],
		]);
	},
);

boardReadStory.it("a status publication outside a pass publishes at once", [hasBoardItems(1)], function* ({ deferStatus, publications }) {
	yield* deferStatus();

	expect(yield* publications()).toEqual(["fleet/status.md"]);
});

boardReadStory.it(
	"a fiber that outlives its pass publishes its status at once",
	[hasBoardItems(1)],
	function* ({ deferStatus, holdPassAfter, publications }) {
		const waiting = yield* holdPassAfter(deferStatus());
		expect(yield* publications()).toEqual([]);

		yield* waiting.resume();

		expect(yield* publications()).toEqual(["fleet/status.md"]);
	},
);
