import { Context, Data, Deferred, Effect, Exit, Layer, Option, type Queue, Redacted, Schema, Scope } from "effect";
import { TestClock } from "effect/testing";
import { vi } from "vitest";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { JobsClientFactory } from "@shivaedev/jobs/server/JobsClientFactory.ts";
import { makePgBoss, pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import { liveHost } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";
import { makePgBossTesting } from "@shivaedev/test-kits/jobs/testing.ts";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { emptyPostgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { JobsWithRetry } from "#JobsWithRetry.ts";
import { pgBossQueues } from "#server/adapters/pgBossQueues.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import { adminRpc } from "#test/adminRpc.ts";
import { FakeUsers } from "#test/FakeUsers.ts";
import { jobsClient } from "#test/jobsClient.ts";
import { Mail, Private, pages, queues, Sync } from "#test/jobsPages.ts";
import { ScheduledWorker } from "#test/ScheduledWorker.ts";

const { url, configured: postgresConfigured } = postgresTestUrl("PLATFORM_JOBS_TEST_DATABASE_URL");

export { postgresConfigured };
export const postgresLayer = emptyPostgres(Redacted.make(url ?? "postgresql://integration-tests-disabled"));

class WorkerRejected extends Data.TaggedError("WorkerRejected")<{ readonly id: number }> {
	override get message() {
		return `the worker rejected ${this.id}: password=admin-job-secret`;
	}
}
const Jobs = makePgBoss("test/AdminJobs");
const ScheduledJobs = makePgBoss("test/AdminScheduledJobs");
export const HELD_MAIL = 99;
const InvalidMail = defineQueue({ name: Mail.name, schema: Schema.Struct({ invalid: Schema.String }) });

export const jobsEngine = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const scope = yield* Scope.fork(yield* Scope.Scope);
	const clock = yield* TestClock.testClockWith(Effect.succeed);
	const testing = makePgBossTesting({ clock });
	const deliveries: string[] = [];
	const heldMail = { delivering: yield* Deferred.make<void>(), released: yield* Deferred.make<void>() };
	const scheduledRuns: string[] = [];
	const boss: { client?: ReturnType<typeof testing.clientFactory> } = {};
	const holdDelivery = Deferred.succeed(heldMail.delivering, undefined).pipe(Effect.andThen(Deferred.await(heldMail.released)));
	function deliverOnRetry(id: number, job: string) {
		return Effect.suspend(() => {
			const repeated = deliveries.includes(job);
			deliveries.push(job);
			return repeated ? Effect.succeed({ sent: id }) : Effect.fail(new WorkerRejected({ id }));
		});
	}
	let readCount: () => number = function readCount() {
		return 0;
	};
	const context = yield* Layer.build(
		Layer.merge(
			Jobs.layer({
				jobs: [Mail.handle(({ id }, job) => (id === HELD_MAIL ? holdDelivery : deliverOnRetry(id, job.id))), Sync, Private],
			}),
			ScheduledJobs.layer({
				jobs: [
					ScheduledWorker.run(
						Effect.sync(() => scheduledRuns.push("nightly cleanup")).pipe(Effect.andThen(Effect.fail(new WorkerRejected({ id: 0 })))),
					),
				],
			}),
		).pipe(
			Layer.provide(pgBossLayer({ connectionString: database.url, supervise: false })),
			Layer.provide(
				Layer.succeed(JobsClientFactory, (options) => {
					const client = testing.clientFactory(options);
					const query = vi.spyOn(client, "getDb");
					const health = vi.spyOn(client, "getQueue");
					const job = vi.spyOn(client, "findJobs");
					readCount = () => query.mock.calls.length + health.mock.calls.length + job.mock.calls.length;
					boss.client = client;
					return client;
				}),
			),
		),
	).pipe(Effect.provideService(Scope.Scope, scope));
	// Finalizers run in reverse, so this releases a held delivery before the jobs Layer drains its workers.
	yield* Effect.addFinalizer(() => Deferred.succeed(heldMail.released, undefined));
	const jobs = Context.get(context, Jobs);
	const beforeRegistration = readCount();
	const registry = pages();
	const page = registry.pages[0];
	const registration = registerAdmin(registry, {
		jobs: JobsWithRetry,
		users: FakeUsers,
	});
	const host = yield* liveHost(
		registration.group,
		registration.handlers.pipe(Layer.provide(pgBossQueues(Jobs, ...queues)), Layer.provide(Layer.succeed(Jobs, jobs))),
		{ protocol: "websocket" },
	);
	const rpc = yield* adminRpc(registration.group, host);

	return {
		...rpc,
		...(yield* jobsClient(page, rpc.protocol)),
		deliveries,
		failSync: (id: string, output: object) =>
			Effect.promise(() => {
				const client = boss.client;
				if (client?.fail === undefined) {
					throw new Error("The jobs client cannot fail jobs");
				}
				return client.fail(Sync.name, id, output);
			}),
		heldMail,
		ids: new Map<string, string>(),
		jobs,
		names: new Map<string, string>(),
		privateQueue: Private,
		refreshStatistics: testing.refreshQueueStats(),
		registrationReads: () => readCount() - beforeRegistration,
		scheduledRuns,
		sendInvalidMail: jobs.enqueue(InvalidMail, { invalid: "payload" }, { retryLimit: 0 }).pipe(Effect.map(Option.getOrThrow)),
		stopJobs: Scope.close(scope, Exit.void),
		testing,
		views: new Map<string, Queue.Queue<unknown>>(),
	};
});
