import { Effect, Layer } from "effect";
import { authTestDatabase } from "@shivaedev/identity/server/better-auth/testDatabase.ts";
import { makePgBossTesting } from "@shivaedev/jobs/server/testing.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { applicationWorker } from "#server/applicationWorker.ts";
import { SweepExpiredSessions } from "#server/foundationWorker.ts";
import { JobsClientFactory } from "#server/JobsClientFactory.ts";
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
		return { database, storage: yield* authTestDatabase, testing: makePgBossTesting() };
	},
	inspect: () => ({}),
	layer: postgres,
	name: "foundation worker",
	stages: ["sessions"],
	verbs: (engine, story) => ({
		schedules: () => engine.testing.schedules(),
		sessionSweepRuns: Effect.fn("WorkerStory.sessionSweepRuns")(function* () {
			story.tell("the worker's registered session sweep runs");
			yield* engine.testing.trigger(SweepExpiredSessions);
			yield* engine.testing.waitForIdle;
		}),
		storedSessions: Effect.fn("WorkerStory.storedSessions")(function* () {
			const sessions = yield* engine.storage.sessions;
			return sessions.map(({ email }) => email);
		}),
		workerStarts: Effect.fn("WorkerStory.workerStarts")(function* () {
			story.tell("the application's worker starts without an auth host");
			yield* Layer.build(
				applicationWorker({
					databaseUrl: engine.database.url,
					poolSizes: testPoolSizes,
					replacements: Layer.succeed(JobsClientFactory, engine.testing.clientFactory),
				}),
			);
		}),
	}),
});

export const expiredSession = worker.trait("sessions", "alice's session has expired and bob's is live", function* (engine) {
	const { user } = yield* mintUser({ origin: "http://localhost:3000" }, "alice");
	yield* mintUser({ origin: "http://localhost:3000" }, "bob");
	yield* engine.storage.expireSessions(user.id);
});
