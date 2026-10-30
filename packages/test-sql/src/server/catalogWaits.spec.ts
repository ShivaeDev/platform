import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { observation, sessionOpen } from "#test/observation.ts";

for (const [stableReads, reads] of [
	[undefined, 2],
	[3, 3],
] as const) {
	observation.it(
		`with no story session open, the wait settles on zero after ${reads} agreeing reads${stableReads === undefined ? " by default" : ""}`,
		[],
		function* ({ readsAtTheEnd, waitForNoSessions, waitOutcome }) {
			yield* waitForNoSessions(stableReads === undefined ? {} : { stableReads });

			yield* outcomes({
				"reads taken": [readsAtTheEnd(), `${reads} reads of 0 open sessions`],
				"wait outcome": [waitOutcome(), "settled on 0 open sessions"],
			});
		},
	);
}

observation.it(
	"while the story's test clock stays paused, the wait sees alice's session close and settles once two reads in a row see none",
	[sessionOpen("alice")],
	function* ({ readsAtTheEnd, sessionCountsSeen, waitForNoSessions, waitOutcome }) {
		yield* waitForNoSessions({ during: "alice closes after the first read" });

		yield* outcomes({
			"reads at the end": [readsAtTheEnd(), "2 reads of 0 open sessions"],
			"session counts seen": [sessionCountsSeen(), ["1 open session", "0 open sessions"]],
			"wait outcome": [waitOutcome(), "settled on 0 open sessions"],
		});
	},
);

observation.it(
	"a zero read that flips back when bob connects is not accepted, so the wait never settles and ends on bob's session",
	[],
	function* ({ sessionCountsSeen, waitForNoSessions, waitOutcome }) {
		yield* waitForNoSessions({ during: "bob connects after the first read", within: "500 millis" });

		yield* outcomes({
			"session counts seen": [sessionCountsSeen(), ["0 open sessions", "1 open session"]],
			"wait outcome": [waitOutcome(), "never settled, last read 1 open session"],
		});
	},
);

observation.it(
	"a wait that never settles fails stating what it waited for, how many reads it took and the last value",
	[sessionOpen("alice")],
	function* ({ failureMessage, waitForNoSessions }) {
		yield* waitForNoSessions({ every: "1 minute", within: "1 second" });

		expect(yield* failureMessage()).toBe("Timed out after 1s waiting for no story session to be open: 1 read, last value 1");
	},
);
