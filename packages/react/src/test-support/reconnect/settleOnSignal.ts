import { Effect, Fiber, SubscriptionRef } from "effect";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import type { ScreenClock } from "@shivaedev/test-story/server/watchedClock.ts";

export const settleOnSignal = Effect.fnUntraced(function* <A>(
	line: string,
	signal: Effect.Effect<A>,
	options: { readonly clock: ScreenClock; readonly root: HTMLElement; readonly tell: (line: string) => void },
) {
	options.tell(line);
	const waiting = yield* SubscriptionRef.make(true);
	const completion = yield* signal.pipe(
		Effect.tap(() => SubscriptionRef.set(waiting, false)),
		Effect.forkScoped({ startImmediately: true }),
	);
	yield* screenDriver({ ...options, act, pending: SubscriptionRef.changes(waiting) }).settle();
	return yield* Fiber.join(completion);
});
