import { Context, Effect } from "effect";
import type { Buffer, CommitFrame } from "#frame.ts";
import { makeFrame } from "#frame.ts";

export function contextualFrame<A, R, E>(options: {
	readonly beforeCommit: (changes: readonly A[]) => Effect.Effect<void, E, R>;
	readonly buffer: Buffer<A>;
	readonly discard: (changes: readonly A[]) => Effect.Effect<void, never, R>;
	readonly name: string;
	readonly provide: <TValue, TFailure, TRequirements>(
		effect: Effect.Effect<TValue, TFailure, TRequirements>,
	) => Effect.Effect<TValue, TFailure, TRequirements>;
	readonly publish: (changes: readonly A[]) => Effect.Effect<void, never, R>;
}): Effect.Effect<CommitFrame<E>, never, R> {
	return Effect.fnUntraced(function* () {
		const captured = yield* Effect.context<R>();
		return makeFrame({
			beforeCommit: (changes) =>
				Effect.updateContext<void, E, R, never>(options.beforeCommit(changes), (current: Context.Context<never>) => Context.merge(captured, current)),
			buffer: options.buffer,
			discard: (changes) => Effect.provideContext(options.discard(changes), captured),
			name: options.name,
			provide: options.provide,
			publish: (changes) => Effect.provideContext(options.publish(changes), captured),
		});
	})();
}
