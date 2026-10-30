import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { database } from "#test/database.ts";
import { poolLimit } from "#test/databaseTraits.ts";

for (const [lock, held, waitedOn] of [
	["row", "a row lock", "the items update"],
	["table", "a table lock", "the items update"],
	["advisory", "an advisory lock", "the advisory lock"],
] as const) {
	database.it(
		`the holder of ${held} releases it only once alice, bob and charlie all wait on ${waitedOn}`,
		[poolLimit(4)],
		function* ({ race, waitingAtRelease }) {
			yield* race({ lock, writes: "guarded" });

			expect(yield* waitingAtRelease()).toEqual([waitedOn, waitedOn, waitedOn]);
		},
	);
}

database.it(
	"the holder releases its advisory lock once alice, bob and charlie wait, ignoring another session that waits on it too",
	[poolLimit(5)],
	function* ({ raceWhileAnotherSessionWaits, raceTally, waitingAtRelease }) {
		yield* raceWhileAnotherSessionWaits();

		yield* outcomes({
			"race tally": [raceTally(), { claimed: 1, full: 2 }],
			"sessions waiting at release": [waitingAtRelease(), ["the advisory lock", "the advisory lock", "the advisory lock", "the advisory lock"]],
		});
	},
);

database.it(
	"guarded writes racing for the last place let one contender claim it and turn two away as full",
	[poolLimit(4)],
	function* ({ race, raceTally }) {
		yield* race({ lock: "table", writes: "guarded" });

		expect(yield* raceTally()).toEqual({ claimed: 1, full: 2 });
	},
);

database.it(
	"unguarded writes racing for the last place all claim it, with results in alice, bob and charlie order",
	[poolLimit(4)],
	function* ({ race, raceResults }) {
		yield* race({ lock: "table", writes: "unguarded" });

		expect(yield* raceResults()).toEqual(["alice", "bob", "charlie"]);
	},
);

database.it(
	"by default the holder rolls back, so a contender waiting on its row reads the seed value",
	[poolLimit(3)],
	function* ({ contenderReadsHeldRow, contenderSaw }) {
		yield* contenderReadsHeldRow();

		expect(yield* contenderSaw()).toBe("seed");
	},
);

database.it(
	"with release commit, a contender waiting on the holder's row reads the holder's write",
	[poolLimit(3)],
	function* ({ contenderReadsHeldRow, contenderSaw }) {
		yield* contenderReadsHeldRow("commit");

		expect(yield* contenderSaw()).toBe("holder");
	},
);
