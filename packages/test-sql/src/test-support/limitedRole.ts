import { Effect, Redacted } from "effect";
import { SqlClient } from "effect/sql";
import { databaseId } from "#internal/databaseOwner.ts";
import { adminUrl } from "./postgres.ts";

export const limitedRole = Effect.fn("ConnectionBudget.limitedRole")(function* (limit = 1) {
	const admin = yield* SqlClient.SqlClient;
	const role = `budget_${yield* databaseId}`;
	yield* Effect.acquireRelease(
		admin`create role ${admin(role)} login createdb connection limit ${admin.literal(String(limit))} password 'budget-test'`,
		() => Effect.orDie(admin`drop role ${admin(role)}`),
	);
	const url = new URL(Redacted.value(adminUrl));
	url.username = role;
	url.password = "budget-test";
	return Redacted.make(url.toString());
});
