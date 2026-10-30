import { Redacted } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { connectionVerbs } from "./connections.ts";
import { controllerVerbs } from "./controller.ts";
import { databaseEngine } from "./databaseEngine.ts";
import { deferralVerbs } from "./deferralVerbs.ts";
import { postgresConfigured, postgresLayer } from "./layer.ts";
import { listingVerbs } from "./listingVerbs.ts";
import { readouts } from "./readouts.ts";
import { releaseVerbs } from "./releaseVerbs.ts";
import { teardownVerbs } from "./teardownVerbs.ts";
import { runtimeVerbs, waitingVerbs } from "./verbs.ts";

export const database = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const { url } = yield* PostgresTestDatabase;
		return databaseEngine(Redacted.value(url), yield* SqlClient.SqlClient);
	},
	inspect: (engine) => ({ logs: engine.logs, startups: [...engine.startups], timeline: engine.timeline }),
	layer: postgresLayer,
	name: "jobs runtimes over a real PostgreSQL database",
	runIf: postgresConfigured,
	stages: ["database", "runtime", "jobs", "afterwards"],
	verbs: (engine, story) => ({
		...runtimeVerbs(engine, story.tell),
		...connectionVerbs(engine, story.tell),
		...controllerVerbs(engine, story.tell),
		...deferralVerbs(engine),
		...listingVerbs(engine, story.tell),
		...releaseVerbs(engine, story.tell),
		...teardownVerbs(engine, story.tell),
		...waitingVerbs(engine, story.tell),
		...readouts(engine),
	}),
});
