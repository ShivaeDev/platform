import { Context, Effect, Layer, Option, Redacted, Ref } from "effect";
import { RpcTest } from "effect/rpc";
import { permissionLayer } from "@shivaedev/identity/server/permissions.ts";
import type { UserSessionShape } from "@shivaedev/identity/server/session.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";
import { AppChanges } from "@shivaedev/server/appHost.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { jobsPage } from "#jobs/page.ts";
import { JobsPermission } from "#permissions.ts";
import { adminRegistry } from "#registry.ts";
import { jobsHandlers } from "#server/jobsHandlers.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import { Access } from "./Access.ts";
import { postgresConfigured, postgresLayer } from "./jobsEngine.ts";

const Jobs = makePgBoss("test/EmptyAdminJobs");
const emptyJobsEngine = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const context = yield* Layer.build(Jobs.layer({ connectionString: Redacted.value(database.url), jobs: [] }));
	const page = jobsPage();
	const registration = registerAdmin(adminRegistry(page), { jobs: jobsHandlers(page, Jobs) });
	const session = yield* Ref.make<Option.Option<UserSessionShape>>(Option.none());
	const auth = permissionLayer(JobsPermission, { origin: () => true, provider: { get: () => Ref.get(session) }, roles: Access });
	const client = yield* RpcTest.makeClient(page.contract).pipe(
		Effect.provide(Layer.merge(registration.handlers, hostChanges(registration.group, AppChanges))),
		Effect.provide(auth),
		Effect.provideService(Jobs, Context.get(context, Jobs)),
	);
	return { client, session };
});

export const emptyJobsStory = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
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

export const emptyJobsAdmin = emptyJobsStory.trait("session", "the caller already has the admin role", ({ session }) =>
	Ref.set(session, Option.some({ user: { email: "operator@example.test", id: "operator", name: "Operator", role: "admin" } })),
);
