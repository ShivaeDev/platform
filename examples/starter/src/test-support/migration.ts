import { getMigrations } from "better-auth/db/migration";
import { Effect } from "effect";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { migrationSteps } from "@shivaedev/effect-test-sql/server/migrationSteps.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { authDatabase } from "@shivaedev/platform/server/better-auth/mount.ts";
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
			const database = yield* PostgresTestDatabase;
			const pool = yield* authDatabase(database.url);
			const steps = yield* migrationSteps({ ...migrations(pool), lockTimeout: "5 seconds" });
			yield* steps.migrateTo("0001_auth");
		}),
		pendingAuthMigrations: Effect.fn("AppStory.pendingAuthMigrations")(function* () {
			const database = yield* PostgresTestDatabase;
			const pool = yield* authDatabase(database.url);
			return yield* Effect.tryPromise(() => getMigrations(authOptions(pool)));
		}),
	}),
});
