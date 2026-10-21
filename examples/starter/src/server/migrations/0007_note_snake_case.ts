import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export const noteSnakeCase = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`alter table notes rename column "ownerId" to owner_id`;
	yield* sql`alter table notes rename column "wordCount" to word_count`;
});
