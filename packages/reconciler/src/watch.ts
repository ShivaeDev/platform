import { type Cause, Clock, Deferred, Effect, FiberHandle, Queue, type Scope } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { type Key, readKeys } from "@shivaedev/changes/keys.ts";
import { PassState } from "#PassState.ts";
import type { Due } from "#Reconciler.ts";

export interface Work<TValue, E, R> {
	readonly act: (value: TValue, fail: (cause: Cause.Cause<E>) => Effect.Effect<unknown>) => Effect.Effect<unknown, E, R>;
	readonly due?: Due<TValue>;
	readonly keys: readonly Key[];
	readonly read: Effect.Effect<TValue, E, R>;
}

export const watch = Effect.fnUntraced(function* <TValue, E, R>(
	work: Work<TValue, E, R>,
	pending: Queue.Queue<void>,
): Effect.fn.Return<never, E, R | Reactivity.Reactivity | Scope.Scope | PassState> {
	const state = yield* PassState;
	const reactivity = yield* Reactivity.Reactivity;
	const failed = yield* Deferred.make<never, E>();
	const timer = yield* FiberHandle.make<void>();
	yield* Effect.acquireRelease(
		Effect.sync(() => reactivity.registerUnsafe(readKeys(work.keys), () => Queue.offerUnsafe(pending, undefined))),
		(release) => Effect.sync(release),
	);
	yield* Queue.offer(pending, undefined);
	const consume = Effect.forever(
		Effect.gen(function* () {
			yield* Queue.take(pending);
			yield* FiberHandle.clear(timer);
			yield* state.running;
			const value = yield* work.read;
			yield* work.act(value, (cause) => Deferred.failCause(failed, cause));
			const now = yield* Clock.currentTimeMillis;
			const reported = work.due?.(value, now);
			const nextDue = reported !== undefined && reported > now ? reported : undefined;
			if (nextDue !== undefined) {
				yield* FiberHandle.run(timer, Effect.andThen(Effect.sleep(nextDue - now), Queue.offer(pending, undefined)).pipe(Effect.asVoid));
			}
			yield* state.waiting(nextDue);
		}),
	);
	return yield* Effect.raceFirst(consume, Deferred.await(failed));
});
