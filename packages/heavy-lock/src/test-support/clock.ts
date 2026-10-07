import { Clock, Console, Effect } from "effect";
import { TestConsole } from "effect/testing";

export interface Scripted {
	readonly lines: readonly string[];
	readonly provide: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
}

// Time moves only when the waiter prints, so the reminder schedule is exercised without real waiting.
export function scriptedClock(startMs: number, onLine: (line: string, lines: readonly string[]) => number): Effect.Effect<Scripted> {
	return Effect.gen(function* () {
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
			sleep: () => Effect.yieldNow,
		};
		const output: Console.Console = {
			...base,
			error: (line: unknown) => {
				lines.push(String(line));
				nowMs += onLine(String(line), lines);
			},
		};
		return {
			lines,
			provide: (effect) => effect.pipe(Effect.provideService(Clock.Clock, clock), Effect.provideService(Console.Console, output)),
		};
	});
}
