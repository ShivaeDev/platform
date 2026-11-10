import { expect } from "vitest";
import { aliceEntryOnDay, tupleBuckets, watches } from "#test/tupleBuckets.ts";

const SUBSCRIBERS = [watches("alice", 1), watches("alice", 2), watches("bob", 1)];

for (const [owner, day] of [
	["alice", 1],
	["alice", 2],
	["bob", 1],
] as const) {
	tupleBuckets.it(`an insert for ${owner} on day ${day} reruns only the query of ${owner}'s day ${day}`, SUBSCRIBERS, function* ({ inserts, woken }) {
		yield* inserts(owner, day);

		expect(yield* woken()).toEqual([`${owner} day ${day}`]);
	});
}

tupleBuckets.it(
	"editing alice's day 1 entry reruns only the query of alice's day 1",
	[aliceEntryOnDay(1), ...SUBSCRIBERS],
	function* ({ editsEntry, woken }) {
		yield* editsEntry();

		expect(yield* woken()).toEqual(["alice day 1"]);
	},
);

tupleBuckets.it(
	"deleting alice's day 1 entry reruns only the query of alice's day 1",
	[aliceEntryOnDay(1), ...SUBSCRIBERS],
	function* ({ deletesEntry, woken }) {
		yield* deletesEntry();

		expect(yield* woken()).toEqual(["alice day 1"]);
	},
);

tupleBuckets.it(
	"moving alice's entry from day 1 to day 2 reruns the queries of both days and not bob's",
	[aliceEntryOnDay(1), ...SUBSCRIBERS],
	function* ({ movesEntryTo, woken }) {
		yield* movesEntryTo(2);

		expect(yield* woken()).toEqual(["alice day 1", "alice day 2"]);
	},
);

tupleBuckets.it("an entry without a day announces its owner bucket and no owner-day bucket", [], function* ({ inserts, publishedBuckets }) {
	yield* inserts("alice", null);

	expect(yield* publishedBuckets()).toEqual(["owner alice"]);
});

tupleBuckets.it(
	"an entry that loses its day announces the owner-day bucket it left and its owner bucket",
	[aliceEntryOnDay(1)],
	function* ({ movesEntryTo, publishedBuckets }) {
		yield* movesEntryTo(null);

		expect(yield* publishedBuckets()).toEqual(["alice day 1", "owner alice"]);
	},
);
