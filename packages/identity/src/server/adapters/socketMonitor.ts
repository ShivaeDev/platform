import { Deferred, Effect } from "effect";

export function socketMonitor(checks: Set<Effect.Effect<void>>) {
	return <E, R>(check: Effect.Effect<void, E, R>) =>
		Effect.gen(function* () {
			const context = yield* Effect.context<R>();
			const ended = yield* Deferred.make<never, E>();
			const run = check.pipe(
				Effect.provideContext(context),
				Effect.catchCause((cause) => Deferred.failCause(ended, cause)),
				Effect.asVoid,
			);
			yield* Effect.acquireRelease(
				Effect.sync(() => checks.add(run)),
				() => Effect.sync(() => checks.delete(run)),
			);
			return yield* Deferred.await(ended);
		});
}
