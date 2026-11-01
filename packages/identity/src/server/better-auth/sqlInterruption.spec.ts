import { expect } from "vitest";
import { aliceSignedIn, authSql, lockedAuthTable } from "#test/better-auth/sqlInterruption.ts";

for (const kind of ["session lookup", "provider-account lookup", "mounted request"] as const) {
	authSql.it(
		`interrupting a pending ${kind} removes its query from PostgreSQL's activity`,
		[aliceSignedIn, lockedAuthTable(kind)],
		function* ({ interrupt, pendingQueries, startCall }) {
			yield* startCall(kind);
			expect(yield* pendingQueries(1)).toEqual(["Lock"]);

			yield* interrupt();

			expect(yield* pendingQueries(0)).toEqual([]);
		},
	);

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
