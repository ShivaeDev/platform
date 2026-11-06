import { Redacted } from "effect";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { open } from "./engine.ts";
import { migrations } from "./feature.ts";
import { screenVerbs } from "./screenVerbs.ts";

const { url: databaseUrl, configured } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");
const layer = makePostgresTestLayer({
	migrations: { ...migrations, lockTimeout: "5 seconds" },
	url: Redacted.make(databaseUrl ?? "postgresql://disabled"),
});

export const automatic = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	create: open,
	inspect: ({ host, screen }) => ({
		publications: host.publications,
		reads: host.reads,
		requests: host.requests,
		text: screen.container.textContent,
	}),
	layer,
	name: "automatic live queries",
	runIf: configured,
	stages: ["screen"],
	verbs: screenVerbs,
});
