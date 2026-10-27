import { Cache, Data, Effect, Exit, Queue } from "effect";
import type { Key } from "#keys.ts";
import { ReadPolicy, ReadPolicyMemoWindow } from "#readPolicy.ts";

export const makeHintPolicy = Effect.fnUntraced(function* (capacity: number, retry: (keys: readonly Key[]) => Effect.Effect<void>) {
	const policy = yield* ReadPolicy;
	const window = yield* ReadPolicyMemoWindow;
	const cache = yield* Cache.makeWith(policy, {
		capacity: Math.max(1, capacity),
		timeToLive: (exit) => (Exit.isSuccess(exit) ? window : 0),
	});
	const failed = new Map<string, Key>();
	const wake = yield* Queue.unbounded<void>();
	yield* Queue.take(wake).pipe(
		Effect.andThen(Effect.sleep("1 second")),
		Effect.andThen(
			Effect.suspend(() => {
				const keys = [...failed.values()];
				failed.clear();
				return retry(keys);
			}),
		),
		Effect.forever,
		Effect.forkScoped,
	);
	return (keys: readonly Key[]) =>
		Effect.filter(keys, (key) =>
			Cache.get(cache, new Data.Class<Key>(key)).pipe(
				Effect.catch(() =>
					Effect.gen(function* () {
						if (failed.size === 0) {
							yield* Queue.offer(wake, undefined);
						}
						failed.set(JSON.stringify(key), key);
						return false;
					}),
				),
			),
		);
});
