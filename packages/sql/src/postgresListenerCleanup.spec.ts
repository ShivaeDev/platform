import { expect } from "vitest";
import { changeFeed, feedListens, listenerCleanupStalls } from "#test/changeFeed.ts";

const QUICK = { heartbeatInterval: "1 hour", heartbeatTimeout: "150 millis" } as const;

changeFeed.it(
	"closing the change feed while a listener cleanup stalls finishes once the heartbeat timeout passes",
	[listenerCleanupStalls(), feedListens(QUICK)],
	function* ({ closeFeed }) {
		const ending = yield* closeFeed();

		expect(ending).toBe("closed");
	},
);
