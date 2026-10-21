import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export const createNotes = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table notes (id serial primary key, title text not null)`;
});
