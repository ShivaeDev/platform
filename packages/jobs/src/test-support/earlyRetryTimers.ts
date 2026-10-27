import { Effect } from "effect";
import { vi } from "vitest";
import { boss } from "#test/boss.ts";

export const earlyRetryTimers = boss.trait("configuration", "the host dispatches retry timers before their wall-clock deadline", function* () {
	const schedule = globalThis.setTimeout;
	const timer = vi
		.spyOn(globalThis, "setTimeout")
		.mockImplementation((callback, delay, ...args) =>
			schedule(callback, delay !== undefined && delay > 500 && delay <= 1001 ? delay - 25 : delay, ...args),
		);
	yield* Effect.addFinalizer(() => Effect.sync(() => timer.mockRestore()));
});
