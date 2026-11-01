import { Duration, Effect } from "effect";
import { Store } from "#Store.ts";

export interface RateLimitOptions {
	readonly key: string;
	readonly per: number;
	readonly window: Duration.Input;
}

export const rateLimit = Effect.fn("RateLimit.rateLimit")(function* ({ key, per, window }: RateLimitOptions) {
	const windowMillis = Duration.toMillis(Duration.fromInputUnsafe(window));
	if (!Number.isSafeInteger(per) || per < 1 || !Number.isFinite(windowMillis) || windowMillis <= 0) {
		return yield* Effect.die(new RangeError("Rate limits require a positive integer per and a finite positive window"));
	}
	const store = yield* Store;
	yield* store.consume({ key, per, windowMillis });
});
