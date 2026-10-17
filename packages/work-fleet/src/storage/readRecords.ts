import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export const readRecords = Effect.fn("FleetRow.readRecords")(function* <A, E, R>(namespace: string, body: Effect.Effect<A, E, R>) {
	const sql = yield* SqlClient.SqlClient;
	return yield* sql.withTransaction(
		Effect.gen(function* () {
			yield* sql`select pg_advisory_xact_lock_shared(hashtextextended(${`work_fleet_admission:${namespace}`}, 0))`;
			return yield* body;
		}),
	);
});
