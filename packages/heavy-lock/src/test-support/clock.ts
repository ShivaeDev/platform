import { Clock, Console, Effect } from "effect";
import { TestConsole } from "effect/testing";

export interface Scripted {
	readonly lines: readonly string[];
	readonly provide: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
}

// Advancing time at output and polling boundaries exercises reminders without real waiting.
export const scriptedClock = Effect.fn("HeavyLockTest.scriptedClock")(function* (
	startMs: number,
	onLine: (line: string, lines: readonly string[]) => number,
	onPoll: (nowMs: number, lines: readonly string[]) => number = () => 0,
) {
	const base = yield* TestConsole.make;
	let nowMs = startMs;
	const lines: string[] = [];
	const clock: Clock.Clock = {
		currentTimeMillis: Effect.sync(() => nowMs),
		currentTimeMillisUnsafe: () => nowMs,
		currentTimeNanos: Effect.sync(() => BigInt(nowMs) * 1_000_000n),
		currentTimeNanosUnsafe: () => BigInt(nowMs) * 1_000_000n,
		monotonicTimeNanos: Effect.sync(() => BigInt(nowMs) * 1_000_000n),
		monotonicTimeNanosUnsafe: () => BigInt(nowMs) * 1_000_000n,
		sleep: () =>
			Effect.sync(() => {
				nowMs += onPoll(nowMs, lines);
			}).pipe(Effect.andThen(Effect.yieldNow)),
	};
	const output: Console.Console = {
		...base,
		error: (line: unknown) => {
			lines.push(String(line));
			nowMs += onLine(String(line), lines);
		},
	};
	const scripted: Scripted = {
		lines,
		provide: (effect) => effect.pipe(Effect.provideService(Clock.Clock, clock), Effect.provideService(Console.Console, output)),
	};
	return scripted;
});
