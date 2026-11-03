import { Duration, Effect } from "effect";
import { TestClock } from "effect/testing";
import { vi } from "vitest";

// Atom.debounce owns JavaScript timers outside Effect's clock.
export const controlledDebounceTimers = Effect.acquireRelease(
	Effect.sync(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })),
	() => Effect.sync(() => vi.useRealTimers()),
);

export function debouncePasses(interval: Duration.Input) {
	return TestClock.adjust(interval).pipe(
		Effect.andThen(Effect.promise(() => vi.advanceTimersByTimeAsync(Duration.toMillis(Duration.fromInputUnsafe(interval))))),
	);
}
