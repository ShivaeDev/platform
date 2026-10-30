import { DateTime } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { changesWatched, pullsStored, type RevisionCondition, revisions } from "#test/revisions.ts";

revisions.it("syncing a pull request the store lacks inserts it and reports the insert", [], function* ({ endings, pull, syncPull }) {
	expect(yield* pull()).toBe("failed with no such row");

	yield* syncPull(12);

	yield* outcomes({
		"stored pull request": [pull(), "Revision 12 at 12:00"],
		"sync ending": [endings(), ["inserted Revision 12 at 12:00"]],
	});
});

revisions.it(
	"syncing a newer revision replaces the stored pull request and reports the update",
	[pullsStored([[12, 1]])],
	function* ({ endings, pull, syncPull }) {
		yield* syncPull(13);

		yield* outcomes({
			"stored pull request": [pull(), "Revision 13 at 13:00"],
			"sync ending": [endings(), ["updated Revision 13 at 13:00"]],
		});
	},
);

for (const hour of [11, 12]) {
	revisions.it(
		`syncing a revision at ${hour}:00 leaves the stored 12:00 revision, reports it unchanged and announces no change`,
		[pullsStored([[12, 1]]), changesWatched()],
		function* ({ announcedChanges, endings, pull, syncPull }) {
			yield* syncPull(hour);

			yield* outcomes({
				"announced changes": [announcedChanges(), []],
				"stored pull request": [pull(), "Revision 12 at 12:00"],
				"sync ending": [endings(), ["unchanged"]],
			});
		},
	);
}

revisions.it(
	"a writer waiting behind the row lock of an uncommitted newer revision reports unchanged instead of overwriting it",
	[pullsStored([[10, 1]])],
	function* ({ endings, pull, syncPullWhileNewerRevisionLocked }) {
		yield* syncPullWhileNewerRevisionLocked(11, 13);

		yield* outcomes({
			"stored pull request": [pull(), "Revision 13 at 13:00"],
			"waiting writer": [endings(), ["unchanged"]],
		});
	},
);

revisions.it(
	"a synced batch reports, in input order, the updated, unchanged and inserted pull requests",
	[
		pullsStored([
			[12, 1],
			[12, 2],
			[12, 3],
		]),
	],
	function* ({ endings, pulls, syncPulls }) {
		yield* syncPulls([
			[13, 1],
			[11, 2],
			[12, 3],
			[14, 4],
		]);

		yield* outcomes({
			"batch ending": [endings(), ["updated Revision 13 at 13:00; unchanged; unchanged; inserted Revision 14 at 14:00"]],
			"stored pull requests": [pulls(), ["1: Revision 13 at 13:00", "2: Revision 12 at 12:00", "3: Revision 12 at 12:00", "4: Revision 14 at 14:00"]],
		});
	},
);

revisions.it(
	"a synced batch whose later row breaks a check constraint fails and rolls back its earlier update",
	[pullsStored([[12, 1]])],
	function* ({ endings, pulls, syncPulls }) {
		yield* syncPulls([
			[13, 1],
			[14, -1],
		]);

		yield* outcomes({
			"batch ending": [endings(), ["failed with a constraint violation (SQLSTATE 23514)"]],
			"stored pull requests": [pulls(), ["1: Revision 12 at 12:00"]],
		});
	},
);

const elevenAm = DateTime.makeUnsafe("2026-10-25T11:00:00Z");

for (const [condition, hour, updateWhere, expected] of [
	[
		"an id list, a title pattern and an updatedAt range bounded by the incoming value all match",
		13,
		{ id: { in: [1, 2] }, title: { like: "Revision%" }, updatedAt: { gte: elevenAm, lt: { excluded: "updatedAt" } } },
		"updated Revision 12 at 13:00",
	],
	["the stored title must equal the incoming one", 14, { title: { excluded: "title" } }, "unchanged"],
	["the stored title equals a literal", 14, { title: "Revision 12" }, "updated Revision 12 at 14:00"],
	["the id is in an empty list", 15, { id: { in: [] } }, "unchanged"],
] as const satisfies readonly (readonly [string, number, RevisionCondition, string])[]) {
	revisions.it(
		`an upsert that updates only where ${condition} reports ${expected}`,
		[pullsStored([[12, 1]])],
		function* ({ endings, syncPullWhere }) {
			yield* syncPullWhere(hour, updateWhere);

			expect(yield* endings()).toEqual([expected]);
		},
	);
}
