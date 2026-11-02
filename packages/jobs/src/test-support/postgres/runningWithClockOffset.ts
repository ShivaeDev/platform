import { Clock, Effect } from "effect";
import type { Registration } from "#test/workers.ts";
import { database } from "./database.ts";
import { type StartOptions, startRuntime } from "./engine.ts";

export function runningWithClockOffset(name: string, jobs: readonly Registration[], offset: number, options: StartOptions) {
	return database.trait("runtime", `${name} runs with its clock ${offset} ms from PostgreSQL`, (engine) => {
		const live = Clock.Clock.defaultValue();
		function currentTimeMillisUnsafe() {
			return live.currentTimeMillisUnsafe() + offset;
		}
		function currentTimeNanosUnsafe() {
			return live.currentTimeNanosUnsafe() + BigInt(offset) * 1_000_000n;
		}
		return startRuntime(engine, name, jobs, options).pipe(
			Effect.provideService(Clock.Clock, {
				currentTimeMillis: Effect.sync(currentTimeMillisUnsafe),
				currentTimeMillisUnsafe,
				currentTimeNanos: Effect.sync(currentTimeNanosUnsafe),
				currentTimeNanosUnsafe,
				monotonicTimeNanos: live.monotonicTimeNanos,
				monotonicTimeNanosUnsafe: () => live.monotonicTimeNanosUnsafe(),
				sleep: (duration) => live.sleep(duration),
			}),
		);
	});
}
