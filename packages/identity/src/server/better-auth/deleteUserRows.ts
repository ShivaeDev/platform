import type { BetterAuthOptions } from "better-auth";
import { getAuthTables } from "better-auth/db";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { SessionUser } from "#identity.ts";

// Better Auth's session and account tables cascade from the user row, so one delete removes the person's sign-ins with it.
// Verification rows carry no key to the user, so these are the exact identifiers Better Auth 1.7 writes for one person: the user id
// as a reset or deletion token's value, the address in an email code's identifier, and the id leading a change-email or two-factor code's.
const ADDRESS_CODES = ["email-verification", "sign-in", "forget-password"];
export const deleteUserRows = Effect.fn("Identity.deleteUserRows")(function* (options: BetterAuthOptions) {
	const { email, id } = yield* SessionUser;
	const { user, verification } = getAuthTables(options);
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
	const identifier = sql(verification?.fields.identifier?.fieldName ?? "identifier");
	const value = sql(verification?.fields.value?.fieldName ?? "value");
	const codes = ADDRESS_CODES.map((type) => `${type}-otp-${email}`);
	yield* sql`delete from ${sql(verification?.modelName ?? "verification")} where ${value} = ${id} or ${identifier} in ${sql.in(codes)}
		or starts_with(${identifier}, ${`change-email-otp-${id}:`}) or starts_with(${identifier}, ${`2fa-otp-${id}!`})`;
	yield* sql`delete from ${sql(user?.modelName ?? "user")} where id = ${id}`;
});
