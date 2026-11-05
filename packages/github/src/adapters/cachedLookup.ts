import { Cache, Effect, Exit } from "effect";

export const cachedLookup = Effect.fnUntraced(function* <TKey, A, E, R>(lookup: (key: TKey) => Effect.Effect<A, E, R>) {
	const context = yield* Effect.context<R>();
	return yield* Cache.makeWith((key: TKey) => Effect.provide(lookup(key), context), {
		capacity: 100,
		timeToLive: (exit) => (Exit.isSuccess(exit) ? "60 seconds" : 0),
	});
});
