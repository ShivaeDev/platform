import { testUtils } from "better-auth/plugins";
import { DateTime, Effect, Redacted } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/adapters/mount.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";
import { signedInUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { migrationSteps } from "@shivaedev/test-sql/server/migrationSteps.ts";
import { migrationUpgrade } from "@shivaedev/test-sql/server/migrationUpgrade.ts";
import { storyDatabase } from "@shivaedev/test-sql/server/storyDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import userForeignKey from "#modules/notes/server/migrations/0003_user_foreign_key.ts";
import { authOptions } from "#server/authOptions.ts";
import { migrations } from "#server/migrations.ts";
import { secret } from "#test-support/host.ts";
import { configured, postgres } from "#test-support/postgres.ts";

export const migration = storyKit({
	after: { database: (engine) => engine.database.acquire },
	clock: Effect.runSync(DateTime.now),
	*create() {
		return { database: yield* storyDatabase(), userId: "" };
	},
	layer: postgres,
	name: "notes schema",
	runIf: configured,
	stages: ["database", "schema"],
	verbs: (engine, story) => ({
		addNotes: Effect.fn("NotesStory.addNotes")(function* () {
			story.tell("the notes migration runs on the foundation schema");
			return yield* migrationUpgrade({ migrations: { ...(yield* migrations()), lockTimeout: "5 seconds" }, table: "notes", upTo: 1 });
		}),
		addUserReference: () => {
			story.tell("the user foreign-key migration runs over the existing notes");
			return migratePostgres({
				loader: Migrator.fromRecord({ "3_user_foreign_key": userForeignKey }),
				lockTimeout: "5 seconds",
				table: "app_migrations",
			});
		},
		aliceIsDeleted: () =>
			Effect.gen(function* () {
				story.tell("alice's account is deleted");
				const { auth } = yield* betterAuthMount({
					...authOptions(),
					database: yield* betterAuthDatabase(),
					plugins: [testUtils()],
					secret: Redacted.value(secret),
				}).pipe(Effect.provide(memoryStore));
				yield* Effect.promise(async () => (await auth.$context).internalAdapter.deleteUser(engine.userId));
			}),
		storedNoteTitles: Effect.fn("NotesStory.storedNoteTitles")(function* () {
			const sql = yield* SqlClient.SqlClient;
			const rows = yield* sql<{ title: string }>`select title from notes order by title`;
			return rows.map(({ title }) => title);
		}),
	}),
});

export const existingNotes = migration.trait(
	"schema",
	"alice owns a note and an unowned legacy note exists before the user foreign key",
	function* (engine) {
		const steps = yield* migrationSteps({ ...(yield* migrations()), lockTimeout: "5 seconds" });
		yield* steps.migrateTo("0002_notes");
		const { auth } = yield* betterAuthMount({
			...authOptions(),
			database: yield* betterAuthDatabase(),
			plugins: [testUtils()],
			secret: Redacted.value(secret),
		}).pipe(Effect.provide(memoryStore));
		const { user } = yield* signedInUser(auth, { email: "alice@migration.test", name: "Alice" });
		engine.userId = user.id;
		const sql = yield* SqlClient.SqlClient;
		yield* sql`insert into notes (owner_id, title) values (${user.id}, 'Alice note'), (null, 'Legacy note')`;
	},
);

export const emptyDatabase = migration.trait("database", "the story starts before migrations, from an empty database", (engine) => {
	engine.database.select("empty");
});
