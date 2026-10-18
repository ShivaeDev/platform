import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { admissionLockKey } from "#storage/admissionLockKey.ts";

export const readRecords = Effect.fn("FleetRow.readRecords")(function* <A, E, R>(namespace: string, body: Effect.Effect<A, E, R>) {
	const sql = yield* SqlClient.SqlClient;
	return yield* sql.withTransaction(
		Effect.gen(function* () {
			yield* sql`select pg_advisory_xact_lock_shared(hashtextextended(${admissionLockKey(namespace)}, 0))`;
			return yield* body;
		}),
	);
});

// Receipt and status reads must not queue behind admission; MVCC keeps root fields and children at one committed version.
export const readRecordSnapshot = Effect.fn("FleetRow.readRecordSnapshot")(function* <A, E, R>(body: Effect.Effect<A, E, R>) {
	const sql = yield* SqlClient.SqlClient;
	return yield* sql.withTransaction(sql`set transaction isolation level repeatable read, read only`.pipe(Effect.andThen(body)));
});
