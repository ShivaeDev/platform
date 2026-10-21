import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export const noteWordCount = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`alter table notes add column "wordCount" integer`;
	yield* sql`update notes set "wordCount" = cardinality(regexp_split_to_array(trim(title), '[[:space:]]+'))`;
});
