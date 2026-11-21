import type { BetterAuthOptions } from "better-auth";
import { getAuthTables } from "better-auth/db";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { SessionUser } from "#identity.ts";

// Better Auth's session and account tables cascade from the user row, so one delete removes the person's sign-ins with it.
// Verification rows carry no key to the user: Better Auth stores the user id as a token's value, or the address in an identifier.
export const deleteUserRows = Effect.fn("Identity.deleteUserRows")(function* (options: BetterAuthOptions) {
	const { email, id } = yield* SessionUser;
	const { user, verification } = getAuthTables(options);
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
	const identifier = sql(verification.fields.identifier?.fieldName ?? "identifier");
	const value = sql(verification.fields.value?.fieldName ?? "value");
	yield* sql`delete from ${sql(verification.modelName)} where ${value} = ${id} or ${identifier} = ${email}
		or right(${identifier}, char_length(${email}) + 1) in (${`-${email}`}, ${`:${email}`})`;
	yield* sql`delete from ${sql(user.modelName)} where id = ${id}`;
});
