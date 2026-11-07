import { Clock, Console, Duration, Effect, Option } from "effect";
import { failWith } from "#error.ts";
import type { Holder } from "#holder.ts";
import { release, tryAcquire } from "#lockFile.ts";
import { acquiredLine, waitingLine } from "#status.ts";

export type Claim = Omit<Holder, "startedAtMs">;

export interface WaitOptions {
	readonly hungAfter?: Duration.Input;
	readonly pollInterval: Duration.Input;
	readonly remindEvery: Duration.Duration;
}

interface Announced {
	readonly atMs: number;
	readonly id: string;
	readonly mayBeHung: boolean;
}

// Taking the lock and registering its release happen as one step, so an interrupted waiter never leaves a lock behind.
function attempt(lock: string, holder: Holder) {
	return Effect.uninterruptible(
		Effect.tap(tryAcquire(lock, holder), (blocker) =>
			Option.isNone(blocker)
				? Effect.addFinalizer(() =>
						release(lock, holder.id).pipe(Effect.mapError(failWith(`Could not release the heavy-process lock at ${lock}.`)), Effect.orDie),
					)
				: Effect.void,
		),
	);
}

function shouldAnnounce(
	announced: Announced | undefined,
	blocker: Holder,
	nowMs: number,
	remindEvery: Duration.Duration,
	mayBeHung: boolean,
): boolean {
	return announced?.id !== blocker.id || announced.mayBeHung !== mayBeHung || nowMs - announced.atMs >= Duration.toMillis(remindEvery);
}

export const waitForLock = Effect.fn("HeavyLock.waitForLock")(function* (lock: string, claim: Claim, options: WaitOptions) {
	const waitStartedMs = yield* Clock.currentTimeMillis;
	const hungAfterMs = Duration.toMillis(options.hungAfter ?? Duration.minutes(15));
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
		const mayBeHung = holder.startedAtMs - blocker.value.startedAtMs >= hungAfterMs;
		if (shouldAnnounce(announced, blocker.value, holder.startedAtMs, options.remindEvery, mayBeHung)) {
			announced = { atMs: holder.startedAtMs, id: blocker.value.id, mayBeHung };
			yield* Console.error(waitingLine(blocker.value, holder.startedAtMs, mayBeHung));
		}
		yield* Effect.sleep(options.pollInterval);
	}
});
