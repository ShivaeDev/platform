import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table notes (
  id serial primary key,
  owner_id text,
  title text not null,
  version integer not null default 0,
  word_count integer
 )`;
});
