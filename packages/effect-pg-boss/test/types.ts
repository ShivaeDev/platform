import { Context, Effect, Schema } from "effect";
import { defineQueue, makePgBoss } from "../src/index.js";

class HandlerDependency extends Context.Service<HandlerDependency, number>()(
	"@test/HandlerDependency",
) {}

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
	jobs: [
		Queue.handle((payload) =>
			Effect.map(HandlerDependency, (value) => value + payload.count),
		),
	],
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
