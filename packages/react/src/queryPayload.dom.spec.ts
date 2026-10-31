import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	keptPayloadRefreshing,
	payloadChanging,
	queries,
	queryAnswered,
	refreshSupersededByPayload,
	retentionTurnedOff,
} from "#test/queryStories.ts";

const kept = { keepPreviousData: true };

queries.it(
	"with keepPreviousData, changing the payload keeps showing the last answer while the new one loads",
	[queryAnswered("First payload", kept)],
	function* ({ changePayload, shown }) {
		yield* changePayload("second");

		expect(yield* shown()).toEqual({ data: "First payload", failure: "none", status: "refreshing" });
	},
);

queries.it(
	"with keepPreviousData, a new payload that fails shows its failure beside the last answer",
	[payloadChanging()],
	function* ({ fail, shown }) {
		yield* fail("second", "New payload unavailable");

		expect(yield* shown()).toEqual({ data: "First payload", failure: "Unavailable: New payload unavailable", status: "settled" });
	},
);

queries.it(
	"with keepPreviousData, a payload change during a refresh interrupts the refresh's read and keeps the last answer on screen",
	[keptPayloadRefreshing()],
	function* ({ changePayload, interruptedReads, shown }) {
		expect(yield* interruptedReads()).toEqual([]);

		yield* changePayload("third");

		yield* outcomes({
			"interrupted reads": [interruptedReads(), ["second"]],
			shown: [shown(), { data: "First payload", failure: "none", status: "refreshing" }],
		});
	},
);

queries.it(
	"a superseded read that answers after the newest payload does not replace its answer",
	[refreshSupersededByPayload()],
	function* ({ answer, shown }) {
		yield* answer("third", "Third payload");
		yield* answer("refresh", "Stale payload");

		expect(yield* shown()).toEqual({ data: "Third payload", failure: "none", status: "settled" });
	},
);

for (const options of [{}, { keepPreviousData: false }]) {
	const retention = options.keepPreviousData === undefined ? "by default" : "with keepPreviousData false";

	queries.it(
		`${retention}, changing the payload clears the last answer while the new one loads`,
		[queryAnswered("First payload", options)],
		function* ({ changePayload, shown }) {
			yield* changePayload("second");

			expect(yield* shown()).toEqual({ data: "none", failure: "none", status: "loading" });
		},
	);

	queries.it(`${retention}, a new payload that fails leaves no answer on screen`, [payloadChanging(options)], function* ({ fail, shown }) {
		yield* fail("second", "Offline");

		expect(yield* shown()).toEqual({ data: "none", failure: "Unavailable: Offline", status: "settled" });
	});
}

queries.it(
	"with keepPreviousData, moving the query to another registry clears the retained answer",
	[queryAnswered("Previous owner", kept)],
	function* ({ moveToAnotherRegistry, shown }) {
		yield* moveToAnotherRegistry();

		expect(yield* shown()).toEqual({ data: "none", failure: "none", status: "loading" });
	},
);

queries.it(
	"turning keepPreviousData off drops the inherited answer while the new payload loads",
	[payloadChanging()],
	function* ({ changePayload, shown }) {
		expect((yield* shown()).data).toBe("First payload");

		yield* changePayload("second", { keepPreviousData: false });

		expect(yield* shown()).toEqual({ data: "none", failure: "none", status: "loading" });
	},
);

queries.it(
	"after keepPreviousData is turned off, refreshing keeps the current payload's own answer on screen",
	[retentionTurnedOff()],
	function* ({ answer, refresh, shown }) {
		yield* answer("second", "Second payload");

		yield* refresh();

		expect(yield* shown()).toEqual({ data: "Second payload", failure: "none", status: "refreshing" });
	},
);
