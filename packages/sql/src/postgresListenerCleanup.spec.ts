import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { changeFeed, feedListens, listenerCleanupStalls } from "#test/changeFeed.ts";

const QUICK = { heartbeatInterval: "1 hour", heartbeatTimeout: "150 millis", retryDelay: "20 millis" } as const;

changeFeed.it(
	"a lost listener whose cleanup stalls still resyncs live streams before its cleanup finishes",
	[listenerCleanupStalls(), feedListens(QUICK)],
	function* ({ heartbeatGoesUnanswered, listenerHistory, liveStreamResyncs, openLiveStream }) {
		yield* openLiveStream("orders board");

		yield* heartbeatGoesUnanswered();

		yield* outcomes({
			"listener history": [listenerHistory(), ["listen", "cleanup"]],
			"live stream resyncs": [liveStreamResyncs(), { "orders board": 1 }],
		});
	},
);

changeFeed.it(
	"a lost listener whose cleanup stalls listens again once the heartbeat timeout bounds the cleanup, and its old connection is released",
	[listenerCleanupStalls(), feedListens(QUICK)],
	function* ({ deliveryResumes, heartbeatGoesUnanswered, listenerCleanupDeadlinePasses, listenerConnections, listenerHistory, listenerReconnects }) {
		expect(yield* listenerConnections()).toEqual(["listening on the feed channel"]);
		yield* heartbeatGoesUnanswered();
		yield* deliveryResumes();

		yield* listenerCleanupDeadlinePasses();
		yield* listenerReconnects();

		yield* outcomes({
			"listener connections": [listenerConnections(), ["listening on the feed channel"]],
			"listener history": [listenerHistory(), ["listen", "cleanup", "listen"]],
		});
	},
);

changeFeed.it(
	"closing the change feed while a listener cleanup stalls finishes once the heartbeat timeout passes",
	[listenerCleanupStalls(), feedListens(QUICK)],
	function* ({ closeFeed }) {
		const ending = yield* closeFeed();

		expect(ending).toBe("closed");
	},
);
