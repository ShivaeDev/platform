import { Config, Effect, Redacted } from "effect";
import { Migrator } from "effect/sql";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { adminVerbs } from "./adminVerbs.ts";
import { clientVerbs } from "./client.ts";
import { discoveryReadouts } from "./discoveryReadouts.ts";
import { grantVerbs } from "./grantVerbs.ts";
import { type Engine, startEngine } from "./host.ts";
import { oauthVerbs } from "./oauthVerbs.ts";

const postgres = makePostgresTestLayer({
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	url: Effect.runSync(
		Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL").pipe(
			Config.withDefault(Redacted.make("postgresql://postgres:postgres@127.0.0.1:55432/platform_test_sql")),
		),
	),
});

const definition = {
	around: withIsolatedDatabase,
	clock: "live" as const,
	inspect: ({ people, refusal, resource }: Engine) => ({ people: [...people.keys()], refusal, resource }),
	layer: postgres,
	name: "MCP on the application host",
	stages: ["people", "tokens", "connections"] as const,
	verbs: (engine: Engine, story: { readonly tell: (line: string) => void }) => ({
		...adminVerbs(engine, story.tell),
		...clientVerbs(engine, story.tell),
		...discoveryReadouts(engine),
		...grantVerbs(engine, story.tell),
		...oauthVerbs(engine, story.tell),
	}),
};

export const mcp = storyKit({ ...definition, create: () => startEngine() });
export const localMcp = storyKit({ ...definition, create: () => startEngine(true) });
