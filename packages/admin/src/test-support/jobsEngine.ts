import { Context, Data, Effect, Exit, Layer, Option, type Queue, Redacted, Schema, Scope } from "effect";
import { Migrator } from "effect/sql";
import { TestClock } from "effect/testing";
import { vi } from "vitest";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { makePgBoss, pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import { makePgBossTesting } from "@shivaedev/test-kits/jobs/testing.ts";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { jobsHandlersWithRetry } from "#server/jobsHandlersWithRetry.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import { adminRpc } from "#test/adminRpc.ts";
import { jobsClient } from "#test/jobsClient.ts";
import { Mail, Private, pages, Sync } from "#test/jobsPages.ts";
import { Users } from "#test/pages.ts";
import { ScheduledWorker } from "#test/ScheduledWorker.ts";

const { url, configured: postgresConfigured } = postgresTestUrl("PLATFORM_JOBS_TEST_DATABASE_URL");

export { postgresConfigured };
export const postgresLayer = makePostgresTestLayer({
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	prepare: false,
	url: Redacted.make(url ?? "postgresql://integration-tests-disabled"),
});

class WorkerRejected extends Data.TaggedError("WorkerRejected")<{ readonly id: number }> {
	override get message() {
		return `the worker rejected ${this.id}: password=admin-job-secret`;
	}
}
const Jobs = makePgBoss("test/AdminJobs");
const ScheduledJobs = makePgBoss("test/AdminScheduledJobs");
const InvalidMail = defineQueue({ name: Mail.name, schema: Schema.Struct({ invalid: Schema.String }) });

export const jobsEngine = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const scope = yield* Scope.fork(yield* Scope.Scope);
	const clock = yield* TestClock.testClockWith(Effect.succeed);
	const testing = makePgBossTesting({ clock });
	const deliveries: string[] = [];
	const scheduledRuns: string[] = [];
	const boss: { client?: ReturnType<typeof testing.clientFactory> } = {};
	let readCount: () => number = function readCount() {
		return 0;
	};
	const context = yield* Layer.build(
		Layer.merge(
			Jobs.layer({
				jobs: [
					Mail.handle(({ id }, job) =>
						Effect.suspend(() => {
							const repeated = deliveries.includes(job.id);
							deliveries.push(job.id);
							return repeated ? Effect.succeed({ sent: id }) : Effect.fail(new WorkerRejected({ id }));
						}),
					),
					Sync,
					Private,
				],
			}),
			ScheduledJobs.layer({
				jobs: [
					ScheduledWorker.run(
						Effect.sync(() => scheduledRuns.push("nightly cleanup")).pipe(Effect.andThen(Effect.fail(new WorkerRejected({ id: 0 })))),
					),
				],
			}),
		).pipe(
			Layer.provide(
				pgBossLayer({
					clientFactory: (options) => {
						const client = testing.clientFactory(options);
						const query = vi.spyOn(client, "getDb");
						const health = vi.spyOn(client, "getQueue");
						const job = vi.spyOn(client, "findJobs");
						readCount = () => query.mock.calls.length + health.mock.calls.length + job.mock.calls.length;
						boss.client = client;
						return client;
					},
					connectionString: database.url,
					supervise: false,
				}),
			),
		),
	).pipe(Effect.provideService(Scope.Scope, scope));
	const jobs = Context.get(context, Jobs);
	const beforeRegistration = readCount();
	const registry = pages();
	const page = registry.pages[0];
	const registration = registerAdmin(registry, {
		jobs: jobsHandlersWithRetry(page, Jobs),
		users: Users.contract.application.toLayer({ "admin.users.profile": () => Effect.map(SessionUser, (user) => user.email) }),
	});
	const rpc = yield* adminRpc(
		registration.group,
		hostChanges(registration.group)
			.pipe(Layer.provideMerge(registration.handlers))
			.pipe(Layer.provide(Layer.succeed(Jobs, jobs))),
	);

	return {
		...rpc,
		...(yield* jobsClient(page, registry.group, rpc.protocol)),
		deliveries,
		failSync: (id: string, output: object) =>
			Effect.promise(() => {
				const client = boss.client;
				if (client?.fail === undefined) {
					throw new Error("The jobs client cannot fail jobs");
				}
				return client.fail(Sync.name, id, output);
			}),
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
