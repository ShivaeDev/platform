import { Context, Effect, Layer, Option, Redacted, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { Migrator } from "effect/sql";
import { jobsPage } from "@shivaedev/admin/jobs/page.ts";
import { jobSchema } from "@shivaedev/admin/jobs/schemas.ts";
import { adminRegistry } from "@shivaedev/admin/registry.ts";
import { jobsHandlers, jobsReadHandlers } from "@shivaedev/admin/server/jobsHandlers.ts";
import { registerAdmin } from "@shivaedev/admin/server/registerAdmin.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { makePgBoss, pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import { makePgBossTesting } from "@shivaedev/jobs/server/testing.ts";
import { environmentVariable } from "@shivaedev/test-sql/server/adapters/environmentVariable.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appHost } from "#appHost.ts";
import { hostOptions } from "./story.ts";
import { TypedFailures, typedFailure, typedFailureHandlers } from "./typedFailures.ts";

const url = environmentVariable("PLATFORM_JOBS_TEST_DATABASE_URL");
const Jobs = makePgBoss("test/JobsRedaction");
const Mail = defineQueue({ name: "mail", schema: Schema.Struct({ recipient: Schema.String }) });
const page = jobsPage(Mail);
const JobDetails = RpcGroup.make(Rpc.make("jobFailure", { error: jobSchema(Mail), success: Schema.Void }));
const registration = registerAdmin(adminRegistry(page), { jobs: jobsHandlers(page, Jobs) });

export const jobsRedaction = storyKit({
	...hostOptions(),
	around: withIsolatedDatabase,
	layer: makePostgresTestLayer({
		migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
		prepare: false,
		url: Redacted.make(url ?? "postgresql://integration-tests-disabled"),
	}),
	name: "Jobs beside application RPCs",
	runIf: url !== undefined,
	verbs: (state, story) => ({
		...hostOptions().verbs(state, story),
		typedFailure: (failure: "Forbidden" | "Conflict" | "QueryReadDenied") => {
			story.tell(`the native client receives the application's ${failure} failure beside the registered Jobs page`);
			return typedFailure(state.url, failure);
		},
	}),
});

export const registeredJobs = jobsRedaction.trait(
	"configured",
	"the Jobs page and application share a host with a failed private job",
	function* (state) {
		const database = yield* PostgresTestDatabase;
		const sessions = { origin: () => true, provider: { get: () => Effect.succeed(Option.none()) } };
		const testing = makePgBossTesting();
		const services = Jobs.layer({ jobs: [Mail.handle(() => Effect.fail(new Error("private job failure detail")))] }).pipe(
			Layer.provide(pgBossLayer({ clientFactory: testing.clientFactory, connectionString: database.url, supervise: false })),
		);
		const jobs = Context.get(yield* Layer.build(services), Jobs);
		const id = Option.getOrThrow(yield* jobs.enqueue(Mail, { recipient: "private-recipient@example.test" }, { retryLimit: 0 }));
		yield* testing.waitForIdle;
		const handlers = Layer.mergeAll(
			registration.handlers,
			typedFailureHandlers,
			JobDetails.toLayer({
				jobFailure: () =>
					jobsReadHandlers(page, Jobs)
						["admin.jobs.job"]({ id, queue: Mail.name })
						.pipe(
							Effect.orDie,
							Effect.flatMap((job) => Effect.fail(Option.getOrThrow(job))),
						),
			}),
		).pipe(Layer.provide(Layer.succeed(Jobs, jobs)));
		state.build = () =>
			appHost({
				config: state.config,
				group: registration.group.merge(TypedFailures, JobDetails),
				handlers,
				services: Layer.empty,
				sessions: Layer.succeed(SessionPolicy, sessions),
			});
	},
);
