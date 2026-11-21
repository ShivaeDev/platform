import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";

const Identifier = Schema.Struct({ identifier: Schema.String });

export const removedCredential = Effect.fnUntraced(function* (userId: string) {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`delete from account where "userId" = ${userId}`;
});

export const storedVerification = Effect.fnUntraced(function* (identifier: string, value: string) {
	const sql = yield* SqlClient.SqlClient;
	const now = new Date("2026-11-04T12:00:00Z");
	yield* sql`insert into verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt")
		values (${identifier}, ${identifier}, ${value}, ${new Date("2100-01-01")}, ${now}, ${now})`;
});

export const storedVerificationIdentifiers = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const rows = yield* SqlSchema.findAll({
		execute: () => sql`select identifier from verification order by identifier`,
		Request: Schema.Void,
		Result: Identifier,
	})(undefined);
	return rows.map(({ identifier }) => identifier);
});
