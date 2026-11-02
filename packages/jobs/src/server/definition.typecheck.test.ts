import { Context, Effect, Layer, Redacted, Schema, SchemaGetter } from "effect";
import type { SendOptions } from "pg-boss";
import { expectTypeOf } from "vitest";
import { defineSchedule } from "#defineSchedule.ts";
import { defineQueue, type JobRegistration, type QueuePolicy, type RegistrationRequirements } from "#definition.ts";
import type { PgBoss } from "#PgBoss.ts";
import { makePgBoss, pgBossLayer } from "#service.ts";
import { PullRequestJob } from "#test/singletonQueueOptions.ts";

expectTypeOf<QueuePolicy>().toEqualTypeOf<"standard" | "short" | "singleton" | "stately" | "exclusive" | "key_strict_fifo">();

const Queue = defineQueue({
	key: (payload) => {
		expectTypeOf(payload.pullRequestId).toEqualTypeOf<number>();
		expectTypeOf(payload._tag).toEqualTypeOf<"Refresh" | "Reconcile">();
		return `pr:${payload.pullRequestId.toFixed(0)}`;
	},
	name: "pull-request",
	queue: { policy: "singleton" },
	schema: PullRequestJob,
});
const Ordinary = defineQueue({ name: "ordinary", schema: Schema.Struct({}) });
const Jobs = makePgBoss("@test/SingletonJobs");
const program = Effect.gen(function* () {
	const jobs = yield* Jobs;
	yield* jobs.counts(Queue);
	yield* jobs.retry(Queue, "job-id");
	yield* jobs.enqueue(Queue, { _tag: "Refresh", pullRequestId: 42 }, { priority: 1 });
	yield* jobs.enqueue(Queue, { _tag: "Reconcile", pullRequestId: 42 });
	// @ts-expect-error The definition owns the singleton key.
	yield* jobs.enqueue(Queue, { _tag: "Refresh", pullRequestId: 42 }, { singletonKey: "wrong" });
	const conflicting: SendOptions = { singletonKey: "wrong" };
	// @ts-expect-error Non-literal options cannot override the key either.
	yield* jobs.enqueue(Queue, { _tag: "Refresh", pullRequestId: 42 }, conflicting);
	// @ts-expect-error Producers supply decoded payloads.
	yield* jobs.enqueue(Queue, { _tag: "Refresh", pullRequestId: "42" });
	// @ts-expect-error Only declared tagged job kinds are accepted.
	yield* jobs.enqueue(Queue, { _tag: "Unknown", pullRequestId: 42 });
	yield* jobs.enqueue(Ordinary, {}, conflicting);
});
void program;

// @ts-expect-error A singleton queue must declare its key.
defineQueue({ name: "missing-key", queue: { policy: "singleton" }, schema: PullRequestJob });
// @ts-expect-error Queue policies reject typos.
defineQueue({ name: "typo", queue: { policy: "singelton" }, schema: PullRequestJob });
// @ts-expect-error The key must return a string.
defineQueue({ key: () => 42, name: "numeric-key", queue: { policy: "singleton" }, schema: PullRequestJob });

class Handler extends Context.Service<Handler, number>()("@test/RegistrationHandler") {}
class Decoder extends Context.Service<Decoder, number>()("@test/RegistrationDecoder") {}
class Scheduler extends Context.Service<Scheduler, number>()("@test/RegistrationScheduler") {}

const ServiceQueue = defineQueue({
	name: "registration",
	schema: Schema.Struct({
		value: Schema.String.pipe(
			Schema.decodeTo(Schema.String, {
				decode: SchemaGetter.checkEffect(() => Effect.as(Decoder, true)),
				encode: SchemaGetter.passthrough(),
			}),
		),
	}),
});
const OtherQueue = defineQueue({ name: "other", schema: Schema.Struct({ count: Schema.Number }) });
const Schedule = defineSchedule({ cron: "0 * * * *", name: "scheduled" });
const RegistrationJobs = makePgBoss("@test/RegistrationJobs");
const registrations = [
	ServiceQueue.handle(() => Handler),
	OtherQueue.handle(() => Effect.void),
	Schedule.run(Scheduler),
] satisfies readonly JobRegistration[];
const layer = RegistrationJobs.layer({ jobs: registrations });
expectTypeOf<Layer.Services<typeof layer>>().toEqualTypeOf<PgBoss | Handler | Decoder | Scheduler>();

const collection: readonly JobRegistration<Handler | Decoder | Scheduler>[] = registrations;
const collectionLayer = RegistrationJobs.layer({ jobs: collection });
expectTypeOf<Layer.Services<typeof collectionLayer>>().toEqualTypeOf<PgBoss | Handler | Decoder | Scheduler>();
const boot = Layer.build(collectionLayer.pipe(Layer.provide(pgBossLayer({ connectionString: Redacted.make("postgresql://compile-only") })))).pipe(
	Effect.scoped,
);
// @ts-expect-error Worker and decoder services must be provided before the app runs.
Effect.runPromise(boot);
Effect.runPromise(boot.pipe(Effect.provideService(Handler, 1), Effect.provideService(Decoder, 1), Effect.provideService(Scheduler, 1)));

const producerLayer = RegistrationJobs.layer({ jobs: [ServiceQueue] });
expectTypeOf<Layer.Services<typeof producerLayer>>().toEqualTypeOf<PgBoss>();
const emptyLayer = RegistrationJobs.layer({ jobs: [] });
expectTypeOf<Layer.Services<typeof emptyLayer>>().toEqualTypeOf<PgBoss>();

const widened: readonly JobRegistration[] = registrations;
expectTypeOf<RegistrationRequirements<typeof widened>>().toEqualTypeOf<unknown>();
const widenedLayer = RegistrationJobs.layer({ jobs: widened });
expectTypeOf<Layer.Services<typeof widenedLayer>>().toEqualTypeOf<unknown>();

// @ts-expect-error A queue worker must include its handler.
RegistrationJobs.layer({ jobs: [{ _tag: "QueueWorker", queue: ServiceQueue }] });
// @ts-expect-error A queue worker must include its queue definition.
RegistrationJobs.layer({ jobs: [{ _tag: "QueueWorker", handler: () => Effect.void }] });
// @ts-expect-error A scheduled worker must include the effect it runs.
RegistrationJobs.layer({ jobs: [{ _tag: "ScheduledWorker", schedule: Schedule }] });
// @ts-expect-error A scheduled worker must include its schedule definition.
RegistrationJobs.layer({ jobs: [{ _tag: "ScheduledWorker", effect: Effect.void }] });
// @ts-expect-error A schedule needs an effect before it can be registered.
RegistrationJobs.layer({ jobs: [Schedule] });
