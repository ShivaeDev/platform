import { Effect } from "effect";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { migrationUpgrade } from "@shivaedev/effect-test-sql/server/migrationUpgrade.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { authDatabase } from "@shivaedev/platform/server/better-auth/mount.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { migrations } from "#server/migrations.ts";
import { postgres } from "#test-support/postgres.ts";

export const migration = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => ({}),
	layer: postgres,
	name: "notes schema",
	stages: [],
	verbs: (_engine, story) => ({
		addNotes: Effect.fn("NotesStory.addNotes")(function* () {
			story.tell("add the notes module to the foundation schema");
			const database = yield* PostgresTestDatabase;
			const pool = yield* authDatabase(database.url);
			return yield* migrationUpgrade({ migrations: { ...migrations(pool), lockTimeout: "5 seconds" }, table: "notes", upTo: 1 });
		}),
	}),
});
