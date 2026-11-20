import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { poolTeardown } from "#test/app-host/poolTeardown.ts";

poolTeardown.it(
	"closing the application database ends its query and listener connections without waiting for PostgreSQL to acknowledge the disconnects, then leaves none open",
	[],
	function* ({ backendQueries, closeProgress, openConnections, postgresEndsEveryBackend, theDatabaseCloses }) {
		expect(yield* backendQueries()).toEqual([expect.stringMatching(/^LISTEN /u), "select 1"]);
		yield* theDatabaseCloses();
		yield* postgresEndsEveryBackend();

		yield* outcomes([
			["close progress", () => closeProgress(), "closed"],
			["open connections", () => openConnections(), 0],
			["backend queries", () => backendQueries(), []],
		]);
	},
);
