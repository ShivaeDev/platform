import { Context, type Duration, Effect, Layer, Option, Redacted, Schema, SchemaGetter } from "effect";
import { expectTypeOf } from "vitest";
import { defineQueue, type JobContext } from "#definition.ts";
import type { PgBossClientOptionsError, PgBossError, PgBossQueueOptionsError } from "#error.ts";
import { makePgBoss, type PgBossDefinition, pgBossLayer } from "#service.ts";
import { defineSchedule } from "./defineSchedule.ts";

class HandlerDependency extends Context.Service<HandlerDependency, number>()("@test/HandlerDependency") {}

expectTypeOf<JobContext["remainingBudget"]>().toEqualTypeOf<Effect.Effect<Duration.Duration>>();

const Queue = defineQueue({
	name: "typed",
	schema: Schema.Struct({
		count: Schema.NumberFromString,
		label: Schema.String,
	}),
});
// @ts-expect-error pg-boss durable payloads must encode and decode as objects.
defineQueue({ name: "primitive", schema: Schema.String });
const Jobs = makePgBoss("@test/TypedJobs");
// @ts-expect-error Connection secrets stay redacted until the pg-boss adapter.
pgBossLayer({ connectionString: "postgresql://compile-only" });
const layer = Jobs.layer({ jobs: [Queue.handle((payload) => Effect.map(HandlerDependency, (value) => value + payload.count))] }).pipe(
	Layer.provide(pgBossLayer({ connectionString: Redacted.make("postgresql://compile-only") })),
);

expectTypeOf<Layer.Error<typeof layer>>().toEqualTypeOf<PgBossError | PgBossQueueOptionsError | PgBossClientOptionsError>();

const boot = Effect.asVoid(Jobs).pipe(Effect.provide(layer));
// @ts-expect-error The handler's service requirement remains visible on the Layer.
Effect.runPromise(boot);
Effect.runPromise(boot.pipe(Effect.provideService(HandlerDependency, 1)));

const program = Effect.gen(function* () {
	const jobs = yield* Jobs;
	yield* jobs.enqueue(Queue, { count: 1, label: "one" });
	const job = Option.getOrThrow(yield* jobs.getJob(Queue, "job-id"));
	expectTypeOf(job.data).toEqualTypeOf<{ readonly count: number; readonly label: string }>();
	yield* jobs.retry(Queue, "job-id");
	yield* jobs.counts(Queue);

	// @ts-expect-error Decoded payload count is a number.
	yield* jobs.enqueue(Queue, { count: "1", label: "one" });
	// @ts-expect-error Missing payload fields remain rejected.
	yield* jobs.enqueue(Queue, { count: 1 });
});
void program;

const EmailJobs = makePgBoss("@test/EmailJobs");
const ReportJobs = makePgBoss("@test/ReportJobs");
const options = { jobs: [] };
const app = pgBossLayer({ connectionString: Redacted.make("postgresql://compile-only") });
const emailLayer = EmailJobs.layer(options).pipe(Layer.provide(app));
const reportLayer = ReportJobs.layer(options).pipe(Layer.provide(app));
const health = Effect.flatMap(EmailJobs, (jobs) => jobs.health());

expectTypeOf<Effect.Services<typeof EmailJobs>>().toEqualTypeOf<"@test/EmailJobs">();
expectTypeOf<Effect.Services<typeof ReportJobs>>().toEqualTypeOf<"@test/ReportJobs">();
expectTypeOf<Layer.Success<typeof emailLayer>>().toEqualTypeOf<"@test/EmailJobs">();
expectTypeOf<Layer.Success<typeof reportLayer>>().toEqualTypeOf<"@test/ReportJobs">();

Effect.runPromise(health.pipe(Effect.provide(emailLayer)));
// @ts-expect-error A different jobs Layer leaves the email service unprovided.
Effect.runPromise(health.pipe(Effect.provide(reportLayer)));

const definition: PgBossDefinition<"@test/EmailJobs"> = EmailJobs;
void definition;

defineQueue({
	key: () => "entity",
	name: "options",
	queue: { heartbeatSeconds: 10, notify: true, partition: true, policy: "singleton", retryDelayMax: 30, warningQueueSize: 100 },
	schema: Schema.Struct({}),
});
// @ts-expect-error The definition owns its name.
defineQueue({ name: "owned-name", queue: { name: "other" }, schema: Schema.Struct({}) });
// @ts-expect-error The adapter owns dead-letter setup.
defineQueue({ name: "owned-dlq", queue: { deadLetter: "other" }, schema: Schema.Struct({}) });

const RequiresDecode = defineQueue({
	name: "requires-decode",
	schema: Schema.Struct({
		value: Schema.String.pipe(
			Schema.decodeTo(Schema.String, {
				decode: SchemaGetter.checkEffect(() => Effect.as(HandlerDependency, true)),
				encode: SchemaGetter.passthrough(),
			}),
		),
	}),
});
const lookup = Effect.flatMap(Jobs, (jobs) => jobs.getJob(RequiresDecode, "id"));
expectTypeOf<Effect.Services<typeof lookup>>().toEqualTypeOf<"@test/TypedJobs" | HandlerDependency>();
const failedListing = Effect.flatMap(Jobs, (jobs) => jobs.failedJobs(RequiresDecode, { limit: 10 }));
expectTypeOf<Effect.Services<typeof failedListing>>().toEqualTypeOf<"@test/TypedJobs" | HandlerDependency>();
expectTypeOf<Effect.Success<typeof failedListing>["jobs"][number]["data"]>().toEqualTypeOf<{ readonly value: string }>();
const deadLetterListing = Effect.flatMap(Jobs, (jobs) => jobs.deadLetteredJobs(RequiresDecode, { limit: 10 }));
expectTypeOf<Effect.Services<typeof deadLetterListing>>().toEqualTypeOf<"@test/TypedJobs" | HandlerDependency>();

const followUpLayer = Jobs.layer({
	jobs: [
		Queue.handle((payload) =>
			Effect.gen(function* () {
				yield* HandlerDependency;
				const jobs = yield* Jobs;
				yield* jobs.enqueue(Queue, payload);
			}),
		),
		defineSchedule({ cron: "0 * * * *", name: "follow-up" }).run(
			Effect.flatMap(Jobs, (jobs) => jobs.enqueue(Queue, { count: 1, label: "scheduled" })),
		),
	],
}).pipe(Layer.provide(pgBossLayer({ connectionString: Redacted.make("postgresql://compile-only") })));
expectTypeOf<Layer.Services<typeof followUpLayer>>().toEqualTypeOf<HandlerDependency>();
const followUpBoot = Effect.asVoid(Jobs).pipe(Effect.provide(followUpLayer));
// @ts-expect-error Self-provision leaves other handler dependencies required.
Effect.runPromise(followUpBoot);
Effect.runPromise(followUpBoot.pipe(Effect.provideService(HandlerDependency, 1)));

const crossJobsLayer = Jobs.layer({
	jobs: [Queue.handle(() => Effect.asVoid(EmailJobs))],
});
expectTypeOf<Layer.Services<typeof crossJobsLayer>>().toEqualTypeOf<"@test/EmailJobs" | import("#PgBoss.ts").PgBoss>();

defineQueue({ name: "batch", schema: Schema.Struct({}), worker: { batchSize: 5, localConcurrency: 3, pollingIntervalSeconds: 1 } });
// @ts-expect-error pg-boss concurrency remains numeric.
defineQueue({ name: "invalid-concurrency", schema: Schema.Struct({}), worker: { localConcurrency: "3" } });
