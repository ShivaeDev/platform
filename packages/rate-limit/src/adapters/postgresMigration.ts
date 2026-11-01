import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export const postgresMigration = Effect.gen(function* () {
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
	yield* sql`create table rate_limit_windows (
		key text primary key,
		count bigint not null,
		expires_at double precision not null
	)`;
});
