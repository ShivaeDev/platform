import { Clock } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { controllerVerbs } from "#test/jobs/postgres/controller.ts";
import { databaseEngine } from "#test/jobs/postgres/databaseEngine.ts";
import { deferralVerbs } from "#test/jobs/postgres/deferralVerbs.ts";
import { engineVerbs } from "#test/jobs/postgres/engineVerbs.ts";
import { postgresConfigured, postgresLayer } from "#test/jobs/postgres/layer.ts";
import { readouts } from "#test/jobs/postgres/readouts.ts";
import { scheduleVerbs } from "#test/jobs/postgres/scheduleVerbs.ts";
import { timeVerbs } from "#test/jobs/postgres/timeVerbs.ts";
import { traceReadouts } from "#test/jobs/postgres/traceReadouts.ts";
import { runtimeVerbs } from "#test/jobs/postgres/verbs.ts";
import { waitingVerbs } from "#test/jobs/postgres/waitingVerbs.ts";

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

		...controllerVerbs(engine, story.tell),
		...engineVerbs(engine, story.tell),
		...deferralVerbs(engine, story.tell),

		...scheduleVerbs(engine, story.tell),

		...timeVerbs(engine, story.tell),
		...waitingVerbs(engine, story.tell),
		...readouts(engine),
		...traceReadouts(engine),
	}),
});
