import { Effect, Option, type Schema } from "effect";
import type { SqlError } from "effect/sql/SqlError";
import { WorkerReleaseClock } from "#WorkerReleaseClock.ts";

export const registerClock = Effect.fn("WorkerRelease.registerClock")(function* <R>(tick: {
	readonly heartbeat: Effect.Effect<void, SqlError | Schema.SchemaError>;
	readonly poll: Effect.Effect<void, SqlError | Schema.SchemaError, R>;
}) {
	const testing = yield* Effect.serviceOption(WorkerReleaseClock);
	if (Option.isSome(testing)) {
		const context = yield* Effect.context<R>();
		yield* testing.value.register({ heartbeat: tick.heartbeat, poll: tick.poll.pipe(Effect.provideContext(context)) });
	}
});
