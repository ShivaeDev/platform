import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export const noteOwner = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`alter table notes add column "ownerId" text`;
});
