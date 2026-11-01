import { Clock, Duration, Effect } from "effect";

export const emailWindow = Effect.fnUntraced(function* (window: Duration.Input = "1 minute") {
	const milliseconds = Duration.toMillis(Duration.fromInputUnsafe(window));
	const entries = yield* Effect.acquireRelease(
		Effect.sync(() => new Map<string, number>()),
		(map) => Effect.sync(() => map.clear()),
	);
	return (account: string, kind: string) =>
		Effect.gen(function* () {
			const now = yield* Clock.currentTimeMillis;
			for (const [entryKey, expiry] of entries) {
				if (expiry > now) {
					break;
				}
				entries.delete(entryKey);
			}
			const key = `${account}:${kind}`;
			const reservedUntil = entries.get(key);
			if (reservedUntil !== undefined && reservedUntil > now) {
				return false;
			}
			entries.delete(key);
			entries.set(key, now + milliseconds);
			return true;
		});
});
