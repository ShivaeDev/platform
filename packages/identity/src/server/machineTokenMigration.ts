import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export const machineTokenMigration = Effect.gen(function* () {
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
	yield* sql`create table identity_machine_tokens (
		id text primary key,
		name text not null,
		"ownerId" text not null,
		scope text not null
	)`;
});
