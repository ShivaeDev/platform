import { Config, ConfigProvider, Effect, Layer } from "effect";
import { createRailwayContext, project, type RailwayProgram } from "railway/iac";
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
		const env: Record<string, string> = {};
		return { database, env, storage: yield* authTestDatabase, testing: makePgBossTesting() };
	},
	inspect: () => ({}),
	layer: postgres,
	name: "foundation worker",
	stages: ["configuration", "sessions"],
	verbs: (engine, story) => ({
		railwayWorkerVariables: () =>
			Effect.promise(async () => {
				story.tell("Railway evaluates the application's deployment configuration");
				const { default: configure }: { default: RailwayProgram } = await import(new URL("../../.railway/railway.ts", import.meta.url).href);
				const configured = await configure(createRailwayContext(), project);
				const service = configured.resources?.find(
					(resource) => !Array.isArray(resource) && resource.type === "service" && resource.name === "worker",
				);
				if (service === undefined || Array.isArray(service) || service.type !== "service") {
					throw new Error("The Railway configuration has no worker service");
				}
				return service.variables;
			}),
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
