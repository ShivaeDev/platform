import { Effect } from "effect";
import { type Assertion, type ExpectStatic, expect } from "vitest";

export function assertThat<TValue>(value: TValue, check: (actual: Assertion<void, TValue>, matchers: ExpectStatic) => void): Effect.Effect<void> {
	return Effect.sync(() => check(expect(value), expect));
}

export function withMatchers<TValue, TError, TServices>(
	check: (matchers: ExpectStatic) => Effect.Effect<TValue, TError, TServices>,
): Effect.Effect<TValue, TError, TServices> {
	return Effect.suspend(() => check(expect));
}
