import { Context, Effect, type Layer, Schema } from "effect";
import { expectTypeOf } from "vitest";
import { defineQueue } from "#definition.ts";
import { makePgBoss, type PgBossDefinition } from "#service.ts";

class HandlerDependency extends Context.Service<HandlerDependency, number>()("@test/HandlerDependency") {}

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
const layer = Jobs.layer({
	connectionString: "postgresql://compile-only",
	jobs: [Queue.handle((payload) => Effect.map(HandlerDependency, (value) => value + payload.count))],
});

const boot = Effect.asVoid(Jobs).pipe(Effect.provide(layer));
// @ts-expect-error The handler's service requirement remains visible on the Layer.
Effect.runPromise(boot);
Effect.runPromise(boot.pipe(Effect.provideService(HandlerDependency, 1)));

const program = Effect.gen(function* () {
	const jobs = yield* Jobs;
	yield* jobs.enqueue(Queue, { count: 1, label: "one" });

	// @ts-expect-error Decoded payload count is a number.
	yield* jobs.enqueue(Queue, { count: "1", label: "one" });
	// @ts-expect-error Missing payload fields remain rejected.
	yield* jobs.enqueue(Queue, { count: 1 });
});
void program;

const EmailJobs = makePgBoss("@test/EmailJobs");
const ReportJobs = makePgBoss("@test/ReportJobs");
const options = { connectionString: "postgresql://compile-only", jobs: [] };
const emailLayer = EmailJobs.layer(options);
const reportLayer = ReportJobs.layer(options);
const health = Effect.flatMap(EmailJobs, (jobs) => jobs.health);

expectTypeOf<Effect.Services<typeof EmailJobs>>().toEqualTypeOf<"@test/EmailJobs">();
expectTypeOf<Effect.Services<typeof ReportJobs>>().toEqualTypeOf<"@test/ReportJobs">();
expectTypeOf<Layer.Success<typeof emailLayer>>().toEqualTypeOf<"@test/EmailJobs">();
expectTypeOf<Layer.Success<typeof reportLayer>>().toEqualTypeOf<"@test/ReportJobs">();

Effect.runPromise(health.pipe(Effect.provide(emailLayer)));
// @ts-expect-error A different jobs Layer leaves the email service unprovided.
Effect.runPromise(health.pipe(Effect.provide(reportLayer)));

const definition: PgBossDefinition<"@test/EmailJobs"> = EmailJobs;
void definition;
