import { Effect } from "effect";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { migrationUpgrade } from "@shivaedev/effect-test-sql/migrationUpgrade.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { makeAuth } from "#server/auth.ts";
import { migrations } from "#server/migrations.ts";
import { secret } from "./host.ts";
import { postgres } from "./postgres.ts";

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
			const { auth } = yield* makeAuth({ databaseUrl: database.url, secret });
			return yield* migrationUpgrade({ migrations: migrations(auth), table: "notes", upTo: engine.upTo });
		}),
	}),
});

export function beforeVersionedNotes() {
	return migration.trait("schema", "the notes schema predates versioned writes", (engine) => {
		engine.upTo = 4;
	});
}
