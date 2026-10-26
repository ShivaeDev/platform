import { Clock, Effect, Exit } from "effect";
import { expect } from "vitest";
import { it } from "#it.ts";
import { withLive } from "#withLive.ts";

for (const [clock, tester] of [
	["test", it.effect],
	["live", it.live],
] as const) {
	tester(`restores the ${clock} clock after a live-time region succeeds or fails`, function* () {
		const selected = yield* Clock.Clock;
		const result = yield* withLive(
			Effect.gen(function* () {
				expect(yield* Clock.currentTimeMillis).toBeGreaterThan(1_000_000);
				yield* Effect.sleep("1 millis");
				return "ready";
			}),
		);
		expect(result).toBe("ready");
		expect(yield* Clock.Clock).toBe(selected);
		const exit = yield* Effect.exit(withLive(Effect.fail("not ready")));
		expect(exit).toEqual(Exit.fail("not ready"));
		expect(yield* Clock.Clock).toBe(selected);
	});
}
