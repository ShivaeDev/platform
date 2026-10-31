import type { BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { Effect } from "effect";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";

export const migrateBetterAuth = Effect.fn("Identity.migrateBetterAuth")(function* (options: Omit<BetterAuthOptions, "database">) {
	const database = yield* betterAuthDatabase();
	const migration = yield* Effect.tryPromise(() => getMigrations({ ...options, database }));
	yield* Effect.tryPromise(() => migration.runMigrations());
});
