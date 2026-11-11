import { Context, Effect, Layer, Option, Ref } from "effect";
import { RpcTest } from "effect/rpc";
import { TestClock } from "effect/testing";
import { moduleHandlers } from "@shivaedev/contract/moduleHandlers.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import type { UserSessionShape } from "@shivaedev/identity/server/session.ts";
import { makePgBoss, pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import { makePgBossTesting } from "@shivaedev/test-kits/jobs/testing.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Jobs as JobsModule } from "#Jobs.ts";
import { JobsPage } from "#jobs/Page.ts";
import { adminRegistry } from "#registry.ts";
import { pgBossQueues } from "#server/adapters/pgBossQueues.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import { Access } from "#test/Access.ts";
import { postgresConfigured, postgresLayer } from "#test/jobsEngine.ts";

const Jobs = makePgBoss("test/EmptyAdminJobs");
const emptyJobsEngine = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const clock = yield* TestClock.testClockWith(Effect.succeed);
	const testing = makePgBossTesting({ clock });
	const context = yield* Layer.build(
		Jobs.layer({ jobs: [] }).pipe(Layer.provide(pgBossLayer({ clientFactory: testing.clientFactory, connectionString: database.url }))),
	);
	const registration = registerAdmin(adminRegistry(JobsPage), { jobs: moduleHandlers(JobsModule) });
	const jobs = Context.get(context, Jobs);
	const session = yield* Ref.make<Option.Option<UserSessionShape>>(Option.none());
	const auth = Layer.succeed(SessionPolicy, { origin: () => true, provider: { get: () => Ref.get(session) }, roles: Access });
	const client = yield* RpcTest.makeClient(JobsPage.contract).pipe(
		Effect.provide(hostChanges(registration.group).pipe(Layer.provideMerge(registration.handlers))),
		Effect.provide(auth),
		Effect.provide(pgBossQueues(Jobs).pipe(Layer.provide(Layer.succeed(Jobs, jobs)))),
	);
	return { client, session };
});

export const emptyJobsStory = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	create: () => emptyJobsEngine,
	layer: postgresLayer,
	name: "admin jobs without queues",
	runIf: postgresConfigured,
	stages: ["session"],
	verbs: ({ client }, story) => ({
		health: () => {
			story.tell("read health with no registered queues");
			return client["admin.jobs.health"]();
		},
	}),
});

export const emptyJobsAdmin = emptyJobsStory.trait("session", "the caller is signed in as admin", ({ session }) =>
	Ref.set(session, Option.some({ user: { email: "admin@example.test", id: "admin", name: "admin", role: "admin" } })),
);
