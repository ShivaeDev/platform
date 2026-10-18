import { expect } from "vitest";
import { authPool, openAuthPool } from "#test-support/authPool.ts";

authPool.it(
	"logs a terminated idle auth connection and keeps serving queries",
	[openAuthPool()],
	function* ({ backend, logs, terminateIdleBackend }) {
		const terminated = yield* terminateIdleBackend();
		expect(logs()).toEqual([
			{
				level: "Debug",
				message: [{ event: "auth_database_idle_client_failed", message: "terminating connection due to administrator command" }],
			},
		]);
		expect(yield* backend()).not.toBe(terminated);
	},
);
