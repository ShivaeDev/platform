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

export const waitForPoll = Effect.fnUntraced(function* (emit: Emit, interval: number, delay: number) {
	const next = (yield* Clock.currentTimeMillis) + delay;
	const nextPollAt = new Date(next).toISOString();
	if (delay > interval) {
		yield* health(emit, "cooldown", { delayMs: delay, message: "GitHub quota pacing", nextPollAt });
	}
	let remaining = delay;
	while (remaining > 0) {
		yield* health(emit, "heartbeat", { nextPollAt });
		yield* Effect.sleep(Math.min(interval, remaining));
		remaining = next - (yield* Clock.currentTimeMillis);
	}
});
