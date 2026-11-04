import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aliceSignedIn, authSql, lockedAuthTable } from "#test/better-auth/sqlInterruption.ts";

for (const kind of ["session lookup", "provider-account lookup", "mounted request"] as const) {
	for (const table of kind === "provider-account lookup" ? ["account"] : ["session", "user"]) {
		authSql.it(
			`interrupting a ${kind} waiting on ${table} releases its PostgreSQL query without console output`,
			[aliceSignedIn, lockedAuthTable(kind, table)],
			function* ({ consoleOutput, interrupt, pendingQueries, settled, startCall }) {
				yield* startCall(kind);
				expect(yield* pendingQueries(1)).toEqual(["Lock"]);

				yield* interrupt();

				yield* settled();
				yield* outcomes([
					["PostgreSQL queries waiting on the lock", () => pendingQueries(0), []],
					["console output after Better Auth settles", () => consoleOutput(), []],
				]);
			},
		);
	}

	authSql.it(`an uninterrupted ${kind} returns alice's stored auth data`, [aliceSignedIn], function* ({ call }) {
		expect(yield* call(kind)).toBe(kind === "provider-account lookup" ? "alice-github" : "alice");
	});
}

authSql.it(
	"interrupting one caller leaves the other caller's auth query pending",
	[aliceSignedIn, lockedAuthTable("session lookup")],
	function* ({ interrupt, pendingQueries, startCall }) {
		yield* startCall("session lookup", "alice's first request");
		yield* startCall("session lookup", "alice's second request");
		expect(yield* pendingQueries(2)).toEqual(["Lock", "Lock"]);

		yield* interrupt("alice's first request");

		expect(yield* pendingQueries(1)).toEqual(["Lock"]);
	},
);
