import { Effect, Layer } from "effect";
import { authDatabase } from "@shivaedev/identity/server/better-auth/mount.ts";
import { authTestDatabase } from "@shivaedev/identity/server/better-auth/testDatabase.ts";
import { makePgBossTesting } from "@shivaedev/jobs/server/testing.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { applicationWorker } from "#server/applicationWorker.ts";
import { SweepExpiredSessions } from "#server/foundationWorker.ts";
import { migrateDatabase } from "#server/migrateDatabase.ts";
import { testPoolSizes } from "./poolSizes.ts";
import { postgres } from "./postgres.ts";
import { mintUser } from "./sessionPrecondition.ts";

export const worker = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const database = yield* PostgresTestDatabase;
		yield* Effect.scoped(migrateDatabase(database.url));
		const pool = yield* authDatabase(database.url);
		return { database, storage: authTestDatabase(pool), testing: makePgBossTesting() };
	},
	inspect: () => ({}),
	layer: postgres,
	name: "foundation worker",
	stages: ["sessions"],
	verbs: (engine, story) => ({
		schedules: () => engine.testing.schedules(),
		startWorker: Effect.fn("WorkerStory.startWorker")(function* () {
			story.tell("start the application's worker without an auth host");
			yield* Layer.build(
				applicationWorker({ clientFactory: engine.testing.clientFactory, databaseUrl: engine.database.url, poolSizes: testPoolSizes }),
			);
		}),
		storedSessions: () => engine.storage.sessions,
		triggerSweep: () => {
			story.tell("trigger the worker's registered session sweep");
			return engine.testing.trigger(SweepExpiredSessions);
		},
		waitForIdle: () => engine.testing.waitForIdle,
	}),
});

export const expiredSession = worker.trait("sessions", "Alice's session is expired and Bob's is live", function* (engine) {
	const { user } = yield* mintUser({ origin: "http://localhost:3000" }, "alice");
	yield* mintUser({ origin: "http://localhost:3000" }, "bob");
	yield* engine.storage.expireSessions(user.id);
});
