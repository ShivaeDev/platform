import { Clock, Effect } from "effect";
import type { HealthEvent, WatchEvent } from "#outputEvent.ts";

export type Emit<E = never, R = never> = (event: WatchEvent) => Effect.Effect<void, E, R>;
export type Diagnostic<E = never, R = never> = (message: string) => Effect.Effect<void, E, R>;
export const health = Effect.fnUntraced(function* <E, R>(emit: Emit<E, R>, fields: HealthFields) {
	const at = new Date(yield* Clock.currentTimeMillis).toISOString();
	yield* emit({ at, ...fields });
});

type WithoutTimestamp<T> = T extends HealthEvent ? Omit<T, "at"> : never;
type HealthFields = WithoutTimestamp<HealthEvent>;

export const makeOutput = Effect.fnUntraced(function* <E, R>(emit: Emit<E, R>, heartbeat: number) {
	let lastOutputAt = yield* Clock.currentTimeMillis;
	const write: Emit<E, R> = Effect.fnUntraced(function* (event: WatchEvent) {
		yield* emit(event);
		lastOutputAt = yield* Clock.currentTimeMillis;
	});
	const waitForPoll = Effect.fnUntraced(function* (interval: number, delay: number, message = "GitHub quota pacing") {
		const next = (yield* Clock.currentTimeMillis) + delay;
		const nextPollAt = new Date(next).toISOString();
		if (delay > interval) {
			yield* health(write, { delayMs: delay, event: "cooldown", message, nextPollAt });
		}
		let now = yield* Clock.currentTimeMillis;
		while (now < next) {
			if (heartbeat === 0) {
				yield* Effect.sleep(next - now);
				return;
			}
			const due = lastOutputAt + heartbeat;
			if (now >= due) {
				yield* health(write, { event: "heartbeat", nextPollAt });
			} else {
				yield* Effect.sleep(Math.min(next - now, due - now));
			}
			now = yield* Clock.currentTimeMillis;
		}
	});
	return { emit: write, waitForPoll };
});
