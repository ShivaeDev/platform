import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`alter table "user"
		add column role text,
		add column banned boolean default false,
		add column "banReason" text,
		add column "banExpires" timestamptz`;
	yield* sql`alter table "session" add column "impersonatedBy" text`;
});
