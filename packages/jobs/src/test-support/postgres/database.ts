import { Clock } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { connectionVerbs } from "#test/postgres/connections.ts";
import { controllerVerbs } from "#test/postgres/controller.ts";
import { databaseEngine } from "#test/postgres/databaseEngine.ts";
import { deferralVerbs } from "#test/postgres/deferralVerbs.ts";
import { engineVerbs } from "#test/postgres/engineVerbs.ts";
import { inspectionVerbs } from "#test/postgres/inspectionVerbs.ts";
import { postgresConfigured, postgresLayer } from "#test/postgres/layer.ts";
import { listingVerbs } from "#test/postgres/listingVerbs.ts";
import { readouts } from "#test/postgres/readouts.ts";
import { releaseVerbs } from "#test/postgres/releaseVerbs.ts";
import { scheduleVerbs } from "#test/postgres/scheduleVerbs.ts";
import { teardownVerbs } from "#test/postgres/teardownVerbs.ts";
import { timeVerbs } from "#test/postgres/timeVerbs.ts";
import { traceReadouts } from "#test/postgres/traceReadouts.ts";
import { runtimeVerbs } from "#test/postgres/verbs.ts";
import { waitingVerbs } from "#test/postgres/waitingVerbs.ts";

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
