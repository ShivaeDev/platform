import { Config, Effect, Redacted } from "effect";
import { Migrator } from "effect/sql";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { adminVerbs } from "./adminVerbs.ts";
import { clientVerbs } from "./client.ts";
import { discoveryReadouts } from "./discoveryReadouts.ts";
import { startEngine } from "./host.ts";
import { oauthVerbs } from "./oauthVerbs.ts";

const postgres = makePostgresTestLayer({
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	url: Effect.runSync(
		Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL").pipe(
			Config.withDefault(Redacted.make("postgresql://postgres:postgres@127.0.0.1:55432/platform_test_sql")),
		),
	),
});

export const mcp = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => startEngine,
	inspect: ({ people, refusal, resource }) => ({ people: [...people.keys()], refusal, resource }),
	layer: postgres,
	name: "MCP on the application host",
	stages: ["people", "tokens", "connections"],
	verbs: (engine, story) => ({
		...adminVerbs(engine, story.tell),
		...clientVerbs(engine, story.tell),
		...discoveryReadouts(engine),
		...oauthVerbs(engine, story.tell),
	}),
});
