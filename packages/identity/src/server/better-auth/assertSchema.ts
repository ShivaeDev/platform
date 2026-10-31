import type { BetterAuthOptions } from "better-auth";
import { Effect, Schema } from "effect";
import { type StoredRoleOptions, storedRoleOptions } from "#server/better-auth/adapters/storedRoleOptions.ts";
import { authColumnDrift } from "./columnDrift.ts";
import { betterAuthMigrationPlan } from "./migrationPlan.ts";

export class BetterAuthSchemaDrift extends Schema.TaggedError<BetterAuthSchemaDrift>()("BetterAuthSchemaDrift", {
	missing: Schema.Array(Schema.String),
}) {
	override get message() {
		return `Auth schema needs a new migration:\n${this.missing.join("\n")}`;
	}
}

export const assertBetterAuthSchema = Effect.fn("Identity.assertBetterAuthSchema")(function* (
	options: Omit<BetterAuthOptions, "database">,
	role?: StoredRoleOptions,
) {
	const { missing } = yield* betterAuthMigrationPlan(options, role, { throwOnUnsafe: false });
	missing.push(...(yield* authColumnDrift(storedRoleOptions(options, role), role)));
	if (missing.length > 0) {
		return yield* new BetterAuthSchemaDrift({ missing });
	}
});
