import { expect } from "vitest";
import { postgresProcessHost } from "#test/app-host/processStory.ts";

postgresProcessHost.it(
	"after the proxy kills its idle PostgreSQL connections the host answers a fresh healthy query",
	[],
	function* ({ databaseConnections, disconnectIdlePostgres, health, launch }) {
		yield* launch("database");
		expect(yield* health()).toMatchObject({ status: 200 });
		const before = yield* databaseConnections();
		expect(before).toEqual([{ pid: expect.any(Number), state: "idle" }]);

		yield* disconnectIdlePostgres();

		expect(yield* health()).toMatchObject({ status: 200 });
		const after = yield* databaseConnections();
		expect(after).toEqual([{ pid: expect.any(Number), state: "idle" }]);
		expect(after.map(({ pid }) => pid)).not.toEqual(before.map(({ pid }) => pid));
	},
);
