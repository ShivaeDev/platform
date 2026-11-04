import { DateTime, Effect } from "effect";
import { SqlClient } from "effect/sql";

export const storedExportAccount = Effect.fnUntraced(function* (name: string, userId: string) {
	const sql = yield* SqlClient.SqlClient;
	const now = DateTime.toDateUtc(yield* DateTime.now);
	yield* sql`insert into "account" (id, "accountId", "providerId", "userId", password, "accessToken", "refreshToken", "createdAt", "updatedAt")
		values (${name}, ${name}, 'credential', ${userId}, 'private-password', 'private-access', 'private-refresh', ${now}, ${now})`;
});

export const mappedExportUser = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`alter table "user" rename to members`;
});
