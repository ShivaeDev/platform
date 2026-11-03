import { Context, Effect, Layer, Redacted, Schema, SchemaGetter } from "effect";
import { expectTypeOf } from "vitest";
import { defineSchedule } from "#server/defineSchedule.ts";
import { defineQueue, type JobRegistration, type RegistrationRequirements } from "#server/definition.ts";
import type { EnqueueOptions } from "#server/enqueueOptions.ts";
import type { PgBoss } from "#server/PgBoss.ts";
import type { QueuePolicy } from "#server/queueOptions.ts";
import { makePgBoss, pgBossLayer } from "#server/service.ts";
import { PullRequestJob } from "#test/singletonQueueOptions.ts";

expectTypeOf<QueuePolicy>().toEqualTypeOf<"standard" | "short" | "singleton" | "stately" | "exclusive" | "key_strict_fifo">();

const Queue = defineQueue({
	key: ["pullRequestId"],
	name: "pull-request",
	queue: { policy: "singleton" },
	schema: PullRequestJob,
});
const Ordinary = defineQueue({ name: "ordinary", schema: Schema.Struct({}) });
defineQueue({ name: "subjects", schema: Schema.Struct({ id: Schema.NumberFromString }), subject: [{ field: "id", label: "Message" }] });
// @ts-expect-error Subject columns must name fields in the decoded payload schema.
defineQueue({ name: "subjects", schema: Schema.Struct({ id: Schema.NumberFromString }), subject: [{ field: "missing", label: "Missing" }] });
const Jobs = makePgBoss("@test/SingletonJobs");
const program = Effect.gen(function* () {
	const jobs = yield* Jobs;
	yield* jobs.counts(Queue);
	yield* jobs.retry(Queue, "job-id");
	yield* jobs.enqueue(Queue, { _tag: "Refresh", pullRequestId: 42 }, { priority: 1 });
	yield* jobs.enqueue(Queue, { _tag: "Reconcile", pullRequestId: 42 });
	// @ts-expect-error The definition owns the singleton key.
	yield* jobs.enqueue(Queue, { _tag: "Refresh", pullRequestId: 42 }, { singletonKey: "wrong" });
	const conflicting: EnqueueOptions = { singletonKey: "wrong" };
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
// @ts-expect-error Keys name payload parts instead of using callbacks.
defineQueue({ key: () => "entity", name: "callback-key", queue: { policy: "singleton" }, schema: PullRequestJob });
// @ts-expect-error A singleton part must exist in every payload variant.
defineQueue({ key: ["missing"], name: "unknown-key", queue: { policy: "singleton" }, schema: PullRequestJob });
// @ts-expect-error An id part must exist in the payload schema.
defineQueue({ id: ["missing"], name: "unknown-id", schema: PullRequestJob });

class Handler extends Context.Service<Handler, number>()("@shivaedev/jobs/test/RegistrationHandler") {}
class Decoder extends Context.Service<Decoder, number>()("@shivaedev/jobs/test/RegistrationDecoder") {}
class Scheduler extends Context.Service<Scheduler, number>()("@shivaedev/jobs/test/RegistrationScheduler") {}

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

const Payload = Schema.Struct({ kind: Schema.String, revision: Schema.NumberFromString, tenant: Schema.String });
const Identified = defineQueue({ id: ["tenant", "revision"], name: "identified", schema: Payload });
const Both = defineQueue({ id: ["tenant", "revision"], key: ["tenant"], name: "both", queue: { policy: "singleton" }, schema: Payload });
const IdentityJobs = makePgBoss("@test/IdentityJobs");
const payload = { kind: "refresh", revision: 42, tenant: "alice" };

const identityProgram = Effect.gen(function* () {
	const jobs = yield* IdentityJobs;
	yield* jobs.enqueue(Identified, payload, { priority: 1, singletonKey: "manual" });
	yield* jobs.enqueue(Both, payload, { priority: 1 });
	// @ts-expect-error The queue owns its deterministic id.
	yield* jobs.enqueue(Identified, payload, { id: "override" });
	// @ts-expect-error An id cannot be overridden when the queue also owns its singleton key.
	yield* jobs.enqueue(Both, payload, { id: "override" });
	// @ts-expect-error The queue owns its singleton key.
	yield* jobs.enqueue(Both, payload, { singletonKey: "override" });
	const options: EnqueueOptions = { id: "override", singletonKey: "override" };
	// @ts-expect-error A non-literal options object cannot override either identity.
	yield* jobs.enqueue(Both, payload, options);
});
void identityProgram;

// @ts-expect-error Parts name fields in the decoded schema, without widening it.
defineQueue({ id: ["missing"], name: "missing", schema: Payload });
// @ts-expect-error Singleton parts name fields in the decoded schema.
defineQueue({ key: ["missing"], name: "missing", queue: { policy: "singleton" }, schema: Payload });
// @ts-expect-error Nested values are not scalar identity parts.
defineQueue({ id: ["nested"], name: "nested", schema: Schema.Struct({ nested: Schema.Struct({ id: Schema.String }) }) });
// @ts-expect-error Optional fields are not scalar identity parts.
defineQueue({ id: ["optional"], name: "optional", schema: Schema.Struct({ optional: Schema.optional(Schema.String) }) });
