import { Clock, Console, Duration, Effect, Option } from "effect";
import type { Holder } from "./holder.ts";
import { release, tryAcquire } from "./lock-file.ts";
import { acquiredLine, waitingLine } from "./status.ts";

export type Claim = Omit<Holder, "startedAtMs">;

export interface WaitOptions {
	readonly pollInterval: Duration.Input;
	readonly remindEvery: Duration.Duration;
}

interface Announced {
	readonly id: string;
	readonly atMs: number;
}

// Taking the lock and registering its release happen as one step, so an interrupted waiter never leaves a lock behind.
const attempt = (lock: string, holder: Holder) =>
	Effect.uninterruptible(
		Effect.tap(tryAcquire(lock, holder), (blocker) =>
			Option.isNone(blocker) ? Effect.addFinalizer(() => Effect.ignore(release(lock, holder.id))) : Effect.void,
		),
	);

const shouldAnnounce = (announced: Announced | undefined, blocker: Holder, nowMs: number, remindEvery: Duration.Duration): boolean =>
	announced?.id !== blocker.id || nowMs - announced.atMs >= Duration.toMillis(remindEvery);

export const waitForLock = Effect.fn("HeavyLock.waitForLock")(function* (lock: string, claim: Claim, options: WaitOptions) {
	const waitStartedMs = yield* Clock.currentTimeMillis;
	let announced: Announced | undefined;
	for (;;) {
		const holder: Holder = { ...claim, startedAtMs: yield* Clock.currentTimeMillis };
		const blocker = yield* attempt(lock, holder);
		if (Option.isNone(blocker)) {
			if (announced !== undefined) {
				yield* Console.error(acquiredLine(waitStartedMs, holder.startedAtMs));
			}
			return holder;
		}
		if (shouldAnnounce(announced, blocker.value, holder.startedAtMs, options.remindEvery)) {
			announced = { id: blocker.value.id, atMs: holder.startedAtMs };
			yield* Console.error(waitingLine(blocker.value, holder.startedAtMs));
		}
		yield* Effect.sleep(options.pollInterval);
	}
});
