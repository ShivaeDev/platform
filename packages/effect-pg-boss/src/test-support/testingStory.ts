import { Context, Deferred, Effect, Layer, Option, Redacted, Schema } from "effect";
import { Migrator } from "effect/sql";
import type { JobAttempt, JobWithMetadata, SendOptions } from "pg-boss";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { makePostgresTestLayer } from "@shivaedev/effect-test-sql/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import type { PgBossClient } from "#client.ts";
import { defineQueue } from "#definition.ts";
import { makePgBoss, type PgBossService } from "#service.ts";
import { environmentVariable } from "#test/environment.ts";
import { makePgBossTesting, testRetryPolicy } from "#testing.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL") ?? "";
const Jobs = makePgBoss("@test/TestingStoryJobs");
const layer = makePostgresTestLayer({
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	prepare: false,
	url: Redacted.make(databaseUrl),
});

function* create() {
	const attempts: number[] = [];
	const readout: JobWithMetadata<{ readonly id: number }>[] = [];
	return {
		attempts,
		client: Option.none<PgBossClient>(),
		clientCacheKey: Symbol("testing-story"),
		entered: yield* Deferred.make<void>(),
		jobs: Option.none<PgBossService>(),
		paused: false,
		queue: defineQueue({
			name: "testing-story",
			queue: { expireInSeconds: 60, retryBackoff: true, retryDelay: 100, retryDelayMax: 200, retryLimit: 5 },
			schema: Schema.Struct({ id: Schema.NumberFromString }),
			worker: { batchSize: 2, pollingIntervalSeconds: 0.5 },
		}),
		readout,
		recoverAfter: Number.POSITIVE_INFINITY,
		release: yield* Deferred.make<void>(),
		revision: 0,
		testing: makePgBossTesting({ retryPolicy: testRetryPolicy }),
		worker: false,
	};
}

export const queues = storyKit({
	after: {
		*producer(state) {
			const database = yield* PostgresTestDatabase;
			const context = yield* Layer.build(
				Jobs.layer({
					clientCacheKey: state.clientCacheKey,
					clientFactory: (options) => {
						const client = state.testing.clientFactory(options);
						state.client = Option.some(client);
						return client;
					},
					connectionString: Redacted.value(database.url),
					jobs: [state.queue],
					schema: "story_jobs",
					supervise: false,
				}),
			);
			state.jobs = Option.some(Context.get(context, Jobs));
		},
		*runtime(state) {
			if (!state.worker) {
				return;
			}
			const database = yield* PostgresTestDatabase;
			const worker = state.queue.handle(({ id }) => {
				state.attempts.push(id);
				if (state.paused) {
					return Deferred.succeed(state.entered, undefined).pipe(Effect.andThen(Deferred.await(state.release)));
				}
				return state.attempts.length > state.recoverAfter ? Effect.void : Effect.fail(new Error("The worker fails this attempt"));
			});
			const context = yield* Layer.build(
				Jobs.layer({
					clientCacheKey: state.clientCacheKey,
					clientFactory: state.testing.clientFactory,
					connectionString: Redacted.value(database.url),
					jobs: [worker],
					schema: "story_jobs",
					supervise: false,
				}),
			);
			state.jobs = Option.some(Context.get(context, Jobs));
		},
	},
	around: withIsolatedDatabase,
	clock: "live",
	create,
	inspect: (state) => ({ attempts: state.attempts, jobs: state.readout, revision: state.revision }),
	layer,
	name: "pg-boss testing",
	run: {
		diagnose: (state) => JSON.stringify(state.readout),
		maxSteps: 100,
		*step(state) {
			yield* state.testing.waitForChange(state.revision);
			state.revision = yield* state.testing.revision;
			state.readout = yield* state.testing.jobs(state.queue);
		},
	},
	runIf: databaseUrl !== "",
	stages: ["configuration", "producer", "jobs", "runtime"],
	verbs: (state, story) => ({
		attempts: state.attempts,
		client: Option.getOrThrow(state.client),
		complete: (attempt: JobAttempt) =>
			Effect.promise(() => {
				const client = Option.getOrThrow(state.client);
				if (client.complete === undefined) {
					throw new Error("The testing client must support completion");
				}
				return client.complete(state.queue.name, attempt);
			}),
		queue: state.queue,
		releaseWorker: Deferred.succeed(state.release, undefined),
		send: (id: number, options?: SendOptions) => Option.getOrThrow(state.jobs).enqueue(state.queue, { id }, options),
		settle: () =>
			story
				.runUntil((current) => current.readout.length > 0 && current.readout.every((job) => job.state === "completed" || job.state === "failed"))
				.pipe(Effect.map(() => state.readout)),
		testing: state.testing,
		workerStarted: Deferred.await(state.entered),
	}),
});

export const failingWorker = queues.trait("configuration", "a real worker fails every attempt", (state) => {
	state.worker = true;
});

export const pausedWorker = queues.trait("configuration", "a real worker waits before completing", (state) => {
	state.worker = true;
	state.paused = true;
});

export const recoveringWorker = queues.trait("configuration", "a real worker succeeds after one failed attempt", (state) => {
	state.worker = true;
	state.recoverAfter = 1;
});

export const productionRetries = queues.trait("configuration", "retry settings keep their production policy", (state) => {
	state.testing = makePgBossTesting();
});

export const pendingExpiryRules = queues.trait("jobs", "pending jobs keep the expiry rule from their send", function* (state) {
	const jobs = Option.getOrThrow(state.jobs);
	yield* jobs.enqueue(state.queue, { id: 11 }, { retryLimit: 0 });
	yield* state.testing.expireAfter(state.queue, 1);
	yield* jobs.enqueue(state.queue, { id: 12 });
	yield* state.testing.expireAfter(state.queue, 3);
	const id = Option.getOrThrow(yield* jobs.enqueue(state.queue, { id: 13 }));
	yield* state.testing.expireAfter(state.queue, 1);
	yield* jobs.enqueue(state.queue, { id: 13 }, { id });
});
