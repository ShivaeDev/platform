import { Config, ConfigProvider, DateTime, Effect, Layer } from "effect";
import { authTestDatabase } from "@shivaedev/identity/server/better-auth/testDatabase.ts";
import { makePgBossTesting } from "@shivaedev/test-kits/jobs/testing.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { applicationWorker } from "#server/applicationWorker.ts";
import { SweepExpiredSessions } from "#server/foundationWorker.ts";
import { JobsClientFactory } from "#server/JobsClientFactory.ts";
import { testPoolSizes } from "#test-support/poolSizes.ts";
import { configured, postgres } from "#test-support/postgres.ts";
import { mintUser } from "#test-support/sessionPrecondition.ts";

export const worker = storyKit({
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	*create() {
		const database = yield* PostgresTestDatabase;
		const env: Record<string, string> = {};
		return { database, env, storage: yield* authTestDatabase, testing: makePgBossTesting() };
	},
	inspect: () => ({}),
	layer: postgres,
	name: "foundation worker",
	runIf: configured,
	stages: ["configuration", "sessions"],
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
			return yield* Layer.build(
				applicationWorker({
					databaseUrl: engine.database.url,
					poolSizes: testPoolSizes,
					replacements: Layer.succeed(JobsClientFactory, engine.testing.clientFactory),
				}).pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: engine.env })))),
			).pipe(
				Effect.as("ready"),
				Effect.catchIf(
					(error) => error instanceof Config.ConfigError,
					(error) => Effect.succeed(`configuration failed: ${error.message}`),
				),
			);
		}),
	}),
});

export function productionWithout(variable: "EMAIL_FROM" | "RESEND_API_KEY") {
	return worker.trait("configuration", `production has no ${variable}`, (engine) => {
		engine.env = {
			"EMAIL_FROM": "Accounts <accounts@app.test>",
			"NODE_ENV": "production",
			"PUBLIC_URL": "https://app.test",
			"RESEND_API_KEY": "re_story",
		};
		delete engine.env[variable];
	});
}

export const expiredSession = worker.trait("sessions", "alice's session has expired and bob's is live", function* (engine) {
	const { user } = yield* mintUser({ origin: "http://localhost:3000" }, "alice");
	yield* mintUser({ origin: "http://localhost:3000" }, "bob");
	yield* engine.storage.expireSessions(user.id);
});
