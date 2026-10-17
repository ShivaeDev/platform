import { Effect } from "effect";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { migrationUpgrade } from "@shivaedev/effect-test-sql/migrationUpgrade.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { authDatabase } from "#server/authDatabase.ts";
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
