import { Config, Context, Data, Effect, Exit, Layer, Option, Predicate, type Queue, Redacted, Schema, Scope } from "effect";
import { Migrator } from "effect/sql";
import { vi } from "vitest";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { makePgBoss, pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import { makePgBossTesting } from "@shivaedev/jobs/server/testing.ts";
import { AppChanges } from "@shivaedev/server/appHost.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { jobsHandlersWithRetry } from "#server/jobsHandlersWithRetry.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import { adminRpc } from "./adminRpc.ts";
import { jobsClient } from "./jobsClient.ts";
import { Mail, Private, pages, Scheduled, Sync } from "./jobsPages.ts";
import { Users } from "./pages.ts";

const url = Option.getOrUndefined(Effect.runSync(Config.option(Config.String("PLATFORM_JOBS_TEST_DATABASE_URL"))));
export const postgresConfigured = url !== undefined && url !== "";
if (!postgresConfigured && Effect.runSync(Config.String("CI").pipe(Config.withDefault(""))) !== "") {
	throw new Error("CI requires PLATFORM_JOBS_TEST_DATABASE_URL; skipped PostgreSQL tests prove nothing.");
}
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
const InvalidMail = defineQueue({ name: Mail.name, schema: Schema.Struct({ invalid: Schema.String }) });

export const jobsEngine = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const scope = yield* Scope.fork(yield* Scope.Scope);
	const testing = makePgBossTesting();
	const deliveries: string[] = [];
	const boss: { client?: ReturnType<typeof testing.clientFactory> } = {};
	let readCount: () => number = function readCount() {
		return 0;
	};
	const context = yield* Layer.build(
		Jobs.layer({
			jobs: [
				Mail.handle(({ id }, job) =>
					Effect.suspend(() => {
						const repeated = deliveries.includes(job.id);
						deliveries.push(job.id);
						return repeated ? Effect.succeed({ sent: id }) : Effect.fail(new WorkerRejected({ id }));
					}),
				),
				Scheduled.run(Effect.fail(new WorkerRejected({ id: 0 }))),
				Sync,
				Private,
			],
		}).pipe(
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
	yield* Layer.build(registration.handlers.pipe(Layer.provide(Layer.succeed(Jobs, jobs))));
	const rpc = yield* adminRpc(
		registration.group,
		Layer.merge(registration.handlers, hostChanges(registration.group, AppChanges)).pipe(Layer.provide(Layer.succeed(Jobs, jobs))),
	);

	return {
		...rpc,
		...(yield* jobsClient(page, registry.group, rpc.protocol)),
		deliveries,
		ids: new Map<string, string>(),
		jobs,
		names: new Map<string, string>(),
		privateQueue: Private,
		// The jobs testing kit offers no statistics refresh, so the story runs pg-boss's own on-demand supervision pass.
		refreshStatistics: Effect.promise(async () => {
			const client: unknown = boss.client;
			if (!(Predicate.hasProperty(client, "supervise") && Predicate.isFunction(client.supervise))) {
				throw new Error("The pg-boss client cannot supervise its queues");
			}
			await client.supervise();
		}),
		registrationReads: () => readCount() - beforeRegistration,
		sendInvalidMail: jobs.enqueue(InvalidMail, { invalid: "payload" }, { retryLimit: 0 }).pipe(Effect.map(Option.getOrThrow)),
		stopJobs: Scope.close(scope, Exit.void),
		testing,
		views: new Map<string, Queue.Queue<unknown>>(),
	};
});
