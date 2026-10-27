import { Effect, type Scope, Semaphore } from "effect";
import { transact } from "@shivaedev/sql/transact.ts";
import { reset, StoryDatabase } from "./postgres.ts";

export function rollback<A, E, R>(effect: Effect.Effect<A, E, R>) {
	const sentinel = {};
	return effect.pipe(
		Effect.flatMap((value) => Effect.fail({ sentinel, value })),
		transact({ onSqlError: (error) => error }),
		Effect.catchIf(
			(error): error is { readonly sentinel: typeof sentinel; readonly value: A } =>
				typeof error === "object" && error !== null && "sentinel" in error && error.sentinel === sentinel,
			({ value }) => Effect.succeed(value),
		),
	);
}

const stories = Semaphore.makeUnsafe(1);

export function isolate<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, unknown, R | StoryDatabase | Scope.Scope> {
	return stories.withPermits(1)(
		Effect.gen(function* () {
			const database = yield* StoryDatabase;
			const scoped: Effect.Effect<A, unknown, R> = Effect.scoped(effect);
			return yield* Effect.acquireUseRelease(
				reset(database),
				() => scoped,
				() => reset(database).pipe(Effect.orDie),
			);
		}),
	);
}
