import { expect } from "vitest";
import { authPool, openAuthPool } from "#test/better-auth/pool.ts";

authPool.it(
	"when PostgreSQL terminates an idle auth connection, the pool logs it at debug level",
	[openAuthPool()],
	function* ({ poolLogs, terminateIdleBackend }) {
		yield* terminateIdleBackend();

		expect(yield* poolLogs()).toEqual([
			{ level: "Debug", message: [{ event: "auth_database_idle_client_failed", message: "terminating connection due to administrator command" }] },
		]);
	},
);
