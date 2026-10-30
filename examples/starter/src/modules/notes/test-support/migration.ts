import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { Effect } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { authDatabase } from "@shivaedev/identity/server/better-auth/mount.ts";
import { signedInUser } from "@shivaedev/identity/server/better-auth/testing.ts";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { migrationSteps } from "@shivaedev/test-sql/server/migrationSteps.ts";
import { migrationUpgrade } from "@shivaedev/test-sql/server/migrationUpgrade.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import userForeignKey from "#modules/notes/server/migrations/0003_user_foreign_key.ts";
import { authOptions } from "#server/authOptions.ts";
import { migrations } from "#server/migrations.ts";
import { postgres } from "#test-support/postgres.ts";

export const migration = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const database = yield* PostgresTestDatabase;
		const pool = yield* authDatabase(database.url);
		return { pool, userId: "" };
	},
	layer: postgres,
	name: "notes schema",
	stages: ["schema"],
	verbs: (engine, story) => ({
		addNotes: Effect.fn("NotesStory.addNotes")(function* () {
			story.tell("add the notes module to the foundation schema");
			return yield* migrationUpgrade({ migrations: { ...migrations(engine.pool), lockTimeout: "5 seconds" }, table: "notes", upTo: 1 });
		}),
		addUserReference: () => {
			story.tell("apply the user foreign-key migration to existing notes");
			return migratePostgres({
				loader: Migrator.fromRecord({ "3_user_foreign_key": userForeignKey }),
				lockTimeout: "5 seconds",
				table: "app_migrations",
			});
		},
		deleteUser: () =>
			Effect.promise(async () => {
				story.tell("delete the auth user who owns the existing note");
				const auth = betterAuth({ ...authOptions(engine.pool), plugins: [testUtils()] });
				const { internalAdapter } = await auth.$context;
				await internalAdapter.deleteUser(engine.userId);
			}),
		storedNoteTitles: Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			return yield* sql<{ title: string }>`select title from notes order by title`;
		}),
	}),
});

export const existingNotes = migration.trait("schema", "Alice has an owned note and a legacy note exists before the foreign key", function* (engine) {
	const steps = yield* migrationSteps({ ...migrations(engine.pool), lockTimeout: "5 seconds" });
	yield* steps.migrateTo("0002_notes");
	const auth = betterAuth({ ...authOptions(engine.pool), plugins: [testUtils()] });
	const { user } = yield* Effect.promise(() => signedInUser(auth, { email: "alice@migration.test", name: "Alice" }));
	engine.userId = user.id;
	const sql = yield* SqlClient.SqlClient;
	yield* sql`insert into notes (owner_id, title) values (${user.id}, 'Alice note'), (null, 'Legacy note')`;
});
