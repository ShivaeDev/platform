import { getMigrations } from "better-auth/db/migration";
import { Effect } from "effect";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";
import { migrationSteps } from "@shivaedev/test-sql/server/migrationSteps.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { authOptions } from "#server/authOptions.ts";
import { migrations } from "#server/migrations.ts";
import { postgres } from "#test-support/postgres.ts";

export const migration = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => ({}),
	layer: postgres,
	name: "app authentication schema",
	stages: ["schema"],
	verbs: (_engine, story) => ({
		migrate: Effect.fn("AppStory.migrate")(function* () {
			story.tell("apply every numbered application migration");
			const steps = yield* migrationSteps({ ...migrations(), lockTimeout: "5 seconds" });
			yield* steps.migrateTo("0001_auth");
		}),
		pendingAuthMigrations: Effect.fn("AppStory.pendingAuthMigrations")(function* () {
			const pool = yield* betterAuthDatabase();
			return yield* Effect.tryPromise(() => getMigrations(authOptions(pool)));
		}),
	}),
});
