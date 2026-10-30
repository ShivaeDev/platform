import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { userReference } from "@shivaedev/identity/server/better-auth/userReference.ts";

export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`alter table notes rename column owner_id to user_id`;
	yield* sql`alter table notes add foreign key (user_id)
		references ${sql(userReference.table)} (${sql(userReference.column)}) on delete cascade`;
});
