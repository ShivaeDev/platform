import { Clock, Effect } from "effect";
import type { WatchError } from "#model.ts";

export type Emit = (line: string) => Effect.Effect<void, WatchError>;
export const health = Effect.fnUntraced(function* (
	emit: Emit,
	event: "heartbeat" | "cooldown" | "error" | "stopped",
	fields: Record<string, unknown> = {},
) {
	const at = new Date(yield* Clock.currentTimeMillis).toISOString();
	yield* emit(JSON.stringify({ at, event, ...fields }));
});

export const makeOutput = Effect.fnUntraced(function* (emit: Emit, heartbeat: number) {
	let lastOutputAt = yield* Clock.currentTimeMillis;
	const write: Emit = Effect.fnUntraced(function* (line: string) {
		yield* emit(line);
		lastOutputAt = yield* Clock.currentTimeMillis;
	});
	const waitForPoll = Effect.fnUntraced(function* (interval: number, delay: number) {
		const next = (yield* Clock.currentTimeMillis) + delay;
		const nextPollAt = new Date(next).toISOString();
		if (delay > interval) {
			yield* health(write, "cooldown", { delayMs: delay, message: "GitHub quota pacing", nextPollAt });
		}
		let now = yield* Clock.currentTimeMillis;
		while (now < next) {
			if (heartbeat === 0) {
				yield* Effect.sleep(next - now);
				return;
			}
			const due = lastOutputAt + heartbeat;
			if (now >= due) {
				yield* health(write, "heartbeat", { nextPollAt });
			} else {
				yield* Effect.sleep(Math.min(next - now, due - now));
			}
			now = yield* Clock.currentTimeMillis;
		}
	});
	return { emit: write, waitForPoll };
});
