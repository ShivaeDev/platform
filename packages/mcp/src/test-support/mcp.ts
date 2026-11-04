import { DateTime, type Effect, Redacted } from "effect";
import { Migrator } from "effect/sql";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { adminVerbs } from "./adminVerbs.ts";
import { admissionVerbs } from "./admissionVerbs.ts";
import { banVerbs } from "./banVerbs.ts";
import { clientVerbs } from "./client.ts";
import { discoveryReadouts } from "./discoveryReadouts.ts";
import { grantVerbs } from "./grantVerbs.ts";
import { type Engine, startEngine } from "./host.ts";
import { mixedAuthVerbs } from "./mixedAuthVerbs.ts";
import { oauthVerbs } from "./oauthVerbs.ts";
import { tokenVerbs } from "./tokenVerbs.ts";
import { withControlledDate } from "./withControlledDate.ts";

const { url, configured } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");
const postgres = makePostgresTestLayer({
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	url: Redacted.make(url ?? "postgresql://integration-tests-disabled"),
});

const definition = {
	around: <A, E, R>(effect: Effect.Effect<A, E, R>) => withIsolatedDatabase(withControlledDate(effect)),
	clock: DateTime.makeUnsafe("2026-01-01T00:00:00Z"),
	inspect: ({ people, refusal, resource }: Engine) => ({ people: [...people.keys()], refusal, resource }),
	layer: postgres,
	name: "MCP on the application host",
	runIf: configured,
	stages: ["people", "tokens", "connections"] as const,
	verbs: (engine: Engine, story: { readonly tell: (line: string) => void }) => ({
		...adminVerbs(engine, story.tell),
		...admissionVerbs(engine, story.tell),
		...banVerbs(engine, story.tell),
		...clientVerbs(engine, story.tell),
		...discoveryReadouts(engine),
		...grantVerbs(engine, story.tell),
		...mixedAuthVerbs(engine, story.tell),
		...oauthVerbs(engine, story.tell),
		...tokenVerbs(engine, story.tell),
	}),
};

export const mcp = storyKit({ ...definition, create: () => startEngine() });
export const localMcp = storyKit({ ...definition, create: () => startEngine({ inProcess: true }) });

export const admittedMcp = storyKit({ ...definition, create: () => startEngine({ withAdmission: true }) });

export const customIssuerMcp = storyKit({ ...definition, create: () => startEngine({ issuerPath: "/identity/tenant" }) });
export const rootIssuerMcp = storyKit({ ...definition, create: () => startEngine({ issuerPath: "/" }) });
