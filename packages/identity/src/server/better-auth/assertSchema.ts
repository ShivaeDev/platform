import { Effect, Schema } from "effect";
import { betterAuthMigrationPlan } from "#server/better-auth/adapters/migrationPlan.ts";
import { authColumnDrift } from "#server/better-auth/columnDrift.ts";
import { type AuthSchemaDeclaration, storedRole } from "#server/better-auth/define.ts";
import { storedRoleOptions } from "#server/better-auth/storedRoleOptions.ts";

export class BetterAuthSchemaDrift extends Schema.TaggedError<BetterAuthSchemaDrift>()("BetterAuthSchemaDrift", {
	missing: Schema.Array(Schema.String),
}) {
	override get message() {
		return `Auth schema needs a new migration:\n${this.missing.join("\n")}`;
	}
}

export const assertBetterAuthSchema = Effect.fn("Identity.assertBetterAuthSchema")(function* (auth: AuthSchemaDeclaration) {
	const { options } = auth;
	const role = storedRole(auth);
	const { missing } = yield* betterAuthMigrationPlan(options, role, { throwOnUnsafe: false });
	missing.push(...(yield* authColumnDrift(storedRoleOptions(options, role), role)));
	if (missing.length > 0) {
		return yield* new BetterAuthSchemaDrift({ missing });
	}
});
