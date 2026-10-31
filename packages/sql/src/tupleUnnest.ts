import { Effect, Result } from "effect";
import { SqlClient } from "effect/sql";
import type { TupleColumnType } from "#tupleIn.ts";

export const tupleUnnest = Effect.fnUntraced(function* (types: readonly TupleColumnType[], rows: readonly (readonly unknown[])[]) {
	const sql = yield* SqlClient.SqlClient;
	const pg = yield* Effect.promise(() => import("@effect/sql-pg/PgTypes"));
	const arrays = types.map((type, index) => {
		const entries = rows.map((row) => row[index]);
		const values = entries.map((value) => (pg.isParameter(value) ? value.value : value));
		// String-encoded fields rely on PostgreSQL input casts, including numerics and dates.
		const first = entries.find((value) => value !== null && value !== undefined);
		let oid: number = pg.OID[type];
		if (pg.isParameter(first)) {
			oid = first.oid;
		} else if (first instanceof Date) {
			oid = pg.OID.timestamptz;
		} else if (values.every((value) => value === null || typeof value === "string")) {
			oid = pg.OID.text;
		}
		const parameter = Result.getOrThrow(pg.array(values, oid));
		return sql`${parameter}::${sql.literal(type)}[]`;
	});
	return sql`unnest(${sql.csv(arrays)})`;
});
