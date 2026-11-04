import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { waitForBlockedSessions } from "@shivaedev/test-sql/server/waitForBlockedSessions.ts";

// This deployment story asserts worker readiness and ledger state while schema creation remains blocked.
export const holdSchemaCreation = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const connection = yield* sql.reserve;
	yield* Effect.acquireRelease(connection.executeRaw("BEGIN", []), () => connection.executeRaw("ROLLBACK", []).pipe(Effect.orDie));
	yield* connection.executeRaw("LOCK TABLE pg_namespace IN SHARE MODE", []);
	const [holder]: readonly { readonly pid: number }[] = yield* connection.executeUnprepared("SELECT pg_backend_pid() AS pid", [], undefined);
	if (holder === undefined) {
		return yield* Effect.fail(new Error("Missing schema lock holder"));
	}
	return {
		migrationBlocked: waitForBlockedSessions(holder.pid),
		release: connection.executeRaw("ROLLBACK", []).pipe(Effect.orDie),
	};
});
