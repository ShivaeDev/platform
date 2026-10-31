import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { poolTeardown } from "#test/app-host/poolTeardown.ts";

poolTeardown.it(
	"closing the application database waits for its query and listener connections to disconnect, then leaves none open",
	[],
	function* ({ backendQueries, closeProgress, openConnections, peerAcknowledgesDisconnects, theDatabaseCloses }) {
		expect(yield* backendQueries()).toEqual([expect.stringMatching(/^LISTEN /u), "select 1"]);
		yield* theDatabaseCloses();
		expect(yield* closeProgress()).toBe("waiting for disconnects");

		yield* peerAcknowledgesDisconnects();

		yield* outcomes({
			"close progress": [closeProgress(), "closed"],
			"open connections": [openConnections(), 0],
		});
	},
);
