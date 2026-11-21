import type { BetterAuthOptions } from "better-auth";
import { getAuthTables } from "better-auth/db";
import { Effect, Option, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { BadRequest, PreconditionFailed } from "@shivaedev/errors/taxonomy.ts";
import { SessionUser } from "#identity.ts";
import { passwordMatches } from "#server/better-auth/adapters/passwordMatches.ts";

// Better Auth's own limit when the options set none; a longer input is refused before it reaches the hash.
const MAX_PASSWORD_LENGTH = 128;

const Credential = Schema.Struct({ password: Schema.String });

export const confirmPassword = Effect.fn("Identity.confirmPassword")(function* (options: BetterAuthOptions, password: string) {
	const { id: userId } = yield* SessionUser;
	const { account } = getAuthTables(options);
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
	function column(field: "password" | "providerId" | "userId") {
		return sql(account?.fields[field]?.fieldName ?? field);
	}
	const credential = yield* SqlSchema.findOneOption({
		execute: (id) => sql`select ${column("password")} as password from ${sql(account?.modelName ?? "account")}
			where ${column("userId")} = ${id} and ${column("providerId")} = 'credential' and ${column("password")} is not null`,
		Request: Schema.String,
		Result: Credential,
	})(userId);
	if (Option.isNone(credential)) {
		return yield* new PreconditionFailed({ message: "This account has no password to confirm its deletion with." });
	}
	const maximum = options.emailAndPassword?.maxPasswordLength ?? MAX_PASSWORD_LENGTH;
	if (password.length === 0 || password.length > maximum) {
		return yield* new BadRequest({ field: "password", message: "Enter your current password." });
	}
	if (!(yield* passwordMatches(options, credential.value.password, password))) {
		return yield* new BadRequest({ field: "password", message: "The password is incorrect." });
	}
});
