import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { changeFeed, feedListens, hasTable } from "#test/changeFeed.ts";

const LOST = "Warn: PostgreSQL change listener lost; resynchronizing live streams";
const RETRYING = "Debug: PostgreSQL change listener reconnect failed; retrying";
const RECOVERED = "Info: PostgreSQL change listener recovered; resynchronized live streams";
const QUICK = { heartbeatInterval: "1 hour", heartbeatTimeout: "150 millis", retryDelay: "20 millis" } as const;
const SECONDS = { heartbeatInterval: "1 second", heartbeatTimeout: "1 second", retryDelay: "1 second" } as const;

changeFeed.it(
	"a listener whose heartbeat goes unanswered logs its loss without its cause, listens again after the retry delay and delivers later commits",
	[feedListens(QUICK), hasTable("rows")],
	function* ({ deliveryResumes, heartbeatGoesUnanswered, insertRow, listenerHistory, listenerLog, listenerReconnects, published }) {
		yield* heartbeatGoesUnanswered();
		yield* deliveryResumes();
		expect(yield* listenerHistory()).toEqual(["listen"]);

		yield* listenerReconnects();

		yield* insertRow(1);
		yield* outcomes([
			["listener history", () => listenerHistory(), ["listen", "listen"]],
			["listener log", () => listenerLog(), [LOST, expect.stringMatching(new RegExp(`^${RECOVERED}`, "u"))]],
			["published payloads", () => published(), [["rows", "rows:1"]]],
		]);
	},
);

changeFeed.it(
	"a listener that cannot reconnect logs its loss once as a warning and each failed reconnect at debug level without database causes",
	[feedListens(SECONDS)],
	function* ({ databaseBecomesUnreachable, listenerConnectionIsTerminated, listenerLog, reconnectFails }) {
		yield* databaseBecomesUnreachable();
		yield* listenerConnectionIsTerminated();

		yield* reconnectFails();
		yield* reconnectFails();

		expect(yield* listenerLog()).toEqual([LOST, RETRYING, RETRYING]);
	},
);

changeFeed.it(
	"a recovered listener logs one recovery with its downtime up to the answered heartbeat and the number of open live streams",
	[feedListens(SECONDS)],
	function* ({
		closeLiveStream,
		databaseBecomesReachable,
		databaseBecomesUnreachable,
		listenerConnectionIsTerminated,
		listenerLog,
		listenerReconnectsAnsweringItsHeartbeatAfter,
		openLiveStream,
		reconnectFails,
	}) {
		yield* openLiveStream("orders board");
		yield* openLiveStream("invoice list");
		yield* openLiveStream("closed report");
		yield* closeLiveStream("closed report");
		yield* databaseBecomesUnreachable();
		yield* listenerConnectionIsTerminated();
		yield* reconnectFails();
		yield* databaseBecomesReachable();

		yield* listenerReconnectsAnsweringItsHeartbeatAfter("50 millis");

		expect((yield* listenerLog()).filter((line) => !line.startsWith("Debug"))).toEqual([LOST, `${RECOVERED} (downtimeMs 2050, streamCount 2)`]);
	},
);

changeFeed.it(
	"every open live stream resyncs when the listener is lost, after each failed reconnect and on recovery, and a closed one no longer does",
	[feedListens(SECONDS)],
	function* ({
		closeLiveStream,
		databaseBecomesReachable,
		databaseBecomesUnreachable,
		listenerConnectionIsTerminated,
		listenerReconnects,
		liveStreamResyncs,
		openLiveStream,
		reconnectFails,
	}) {
		yield* openLiveStream("orders board");
		yield* openLiveStream("closed report");
		yield* closeLiveStream("closed report");
		yield* databaseBecomesUnreachable();

		yield* listenerConnectionIsTerminated();
		yield* reconnectFails();
		yield* databaseBecomesReachable();
		yield* listenerReconnects();

		expect(yield* liveStreamResyncs()).toEqual({ "closed report": 0, "orders board": 3 });
	},
);
