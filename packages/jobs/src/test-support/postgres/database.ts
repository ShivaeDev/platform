import { Clock } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { connectionVerbs } from "./connections.ts";
import { controllerVerbs } from "./controller.ts";
import { databaseEngine } from "./databaseEngine.ts";
import { deferralVerbs } from "./deferralVerbs.ts";
import { engineVerbs } from "./engineVerbs.ts";
import { inspectionVerbs } from "./inspectionVerbs.ts";
import { postgresConfigured, postgresLayer } from "./layer.ts";
import { listingVerbs } from "./listingVerbs.ts";
import { readouts } from "./readouts.ts";
import { releaseVerbs } from "./releaseVerbs.ts";
import { scheduleVerbs } from "./scheduleVerbs.ts";
import { teardownVerbs } from "./teardownVerbs.ts";
import { timeVerbs } from "./timeVerbs.ts";
import { traceReadouts } from "./traceReadouts.ts";
import { runtimeVerbs } from "./verbs.ts";
import { waitingVerbs } from "./waitingVerbs.ts";

export const database = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	*create() {
		const { url } = yield* PostgresTestDatabase;
		return databaseEngine(url, yield* SqlClient.SqlClient, yield* Clock.currentTimeMillis);
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
		...engineVerbs(engine, story.tell),
		...deferralVerbs(engine, story.tell),
		...listingVerbs(engine, story.tell),
		...inspectionVerbs(engine, story.tell),
		...releaseVerbs(engine, story.tell),
		...scheduleVerbs(engine, story.tell),
		...teardownVerbs(engine, story.tell),
		...timeVerbs(engine, story.tell),
		...waitingVerbs(engine, story.tell),
		...readouts(engine),
		...traceReadouts(engine, story.tell),
	}),
});
