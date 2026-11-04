import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export const accountPreferencesMigration = Effect.gen(function* () {
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
	yield* sql`create table identity_account_preferences (
		id text primary key,
		locale text not null,
		timezone text not null,
		units text not null
	)`;
});
