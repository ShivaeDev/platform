import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export const noteVersion = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`alter table notes add column version integer not null default 0`;
});
