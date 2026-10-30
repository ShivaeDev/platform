import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { changeFeed } from "#test/changeFeed.ts";

changeFeed.it(
	"a LISTEN that PostgreSQL refuses fails the change feed's startup with its SQL error and logs the cause",
	[],
	function* ({ endings, listenerLog, startFeedListeningOn }) {
		yield* startFeedListeningOn("");

		yield* outcomes({
			"feed endings": [endings(), ["failed with a SQL syntax error (SQLSTATE 42601)"]],
			"listener log": [
				listenerLog(),
				[expect.stringMatching(/^Error: PostgreSQL change listener startup failed after .*zero-length delimited identifier/u)],
			],
		});
	},
);

for (const phase of ["acquisition", "heartbeat"] as const) {
	changeFeed.it(
		`a first LISTEN that stalls in its ${phase} fails the change feed's startup at the heartbeat timeout`,
		[],
		function* ({ startFeedWhoseListenStalls }) {
			const ending = yield* startFeedWhoseListenStalls(phase);

			expect(ending).toBe("failed with a connection failure");
		},
	);
}
