import * as Effect from "effect/Effect";
import { type DeeplyAllowMatchers, expect } from "vitest";
import type { NumericBound } from "#server/adapters/outcomeMatchers.ts";

type NativeMatcher = Exclude<DeeplyAllowMatchers<number>, number>;
export type Expected<T> =
	| NativeMatcher
	| (T extends readonly unknown[]
			? { readonly [TKey in keyof T]: Expected<T[TKey]> }
			: T extends object
				? { readonly [TKey in keyof T]?: Expected<T[TKey]> }
				: T | (T extends number ? NumericBound : never));

export const assertOutcomes = Effect.fnUntraced(function* (actual: readonly Record<string, unknown>[], expected: readonly Record<string, unknown>[]) {
	yield* Effect.sync(() => expect(actual).toMatchObject(expected));
});
