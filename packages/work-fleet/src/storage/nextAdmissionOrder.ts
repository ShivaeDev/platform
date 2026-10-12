import { Effect, Schema } from "effect";
import type { SqlClient } from "effect/unstable/sql";

// Requeueing needs the same database sequence as inserts; repositories cannot allocate sequence values.
export const nextAdmissionOrder = Effect.fn("FleetStore.nextAdmissionOrder")(function* (sql: SqlClient.SqlClient, table: string) {
	const rows = yield* sql`select nextval(pg_get_serial_sequence(${table}, 'admission_order'))::text as value`;
	return yield* Schema.decodeUnknownEffect(Schema.Struct({ value: Schema.BigIntFromString }))(rows[0]).pipe(Effect.map((row) => row.value));
});
