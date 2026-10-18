import { getMigrations } from "better-auth/db/migration";
import { Effect } from "effect";
import { migratePostgres } from "@shivaedev/effect-sql/migrations.ts";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { migrationUpgrade } from "@shivaedev/effect-test-sql/migrationUpgrade.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { authDatabase } from "@shivaedev/platform/better-auth.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { authOptions } from "#server/authOptions.ts";
import { migrations } from "#server/migrations.ts";
import { postgres } from "#test-support/postgres.ts";

export const migration = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => ({ upTo: 0 }),
	layer: postgres,
	name: "notes migration",
	stages: ["schema"],
	verbs: (engine, story) => ({
		migrate: Effect.fn("AppStory.migrate")(function* () {
			story.tell("apply every numbered application migration");
			const database = yield* PostgresTestDatabase;
			const pool = yield* authDatabase(database.url);
			yield* migratePostgres({ ...migrations(pool), lockTimeout: "5 seconds" });
		}),
		pendingAuthMigrations: Effect.fn("AppStory.pendingAuthMigrations")(function* () {
			const database = yield* PostgresTestDatabase;
			const pool = yield* authDatabase(database.url);
			return yield* Effect.tryPromise(() => getMigrations(authOptions(pool)));
		}),
		upgrade: Effect.fn("AppStory.upgrade")(function* () {
			story.tell(`upgrade the notes schema from migration ${engine.upTo}`);
			const database = yield* PostgresTestDatabase;
			const pool = yield* authDatabase(database.url);
			return yield* migrationUpgrade({ migrations: { ...migrations(pool), lockTimeout: "5 seconds" }, table: "notes", upTo: engine.upTo });
		}),
	}),
});

export function beforeVersionedNotes() {
	return migration.trait("schema", "the notes schema predates versioned writes", (engine) => {
		engine.upTo = 4;
	});
}
