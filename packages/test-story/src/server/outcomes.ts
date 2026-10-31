import { Effect } from "effect";
import { type DeeplyAllowMatchers, expect } from "vitest";
import type { NumericBound } from "#adapters/outcomeMatchers.ts";

type AnyReadout = Effect.Effect<unknown, unknown, unknown>;
type NativeMatcher = Exclude<DeeplyAllowMatchers<number>, number>;
type Expected<T> =
	| NativeMatcher
	| (T extends readonly unknown[]
			? { readonly [TKey in keyof T]: Expected<T[TKey]> }
			: T extends object
				? { readonly [TKey in keyof T]?: Expected<T[TKey]> }
				: T | (T extends number ? NumericBound : never));

export const outcomes = Effect.fn("Story.outcomes")(check);

function check<TReadouts extends readonly AnyReadout[]>(
	rows: {
		readonly [TKey in keyof TReadouts]: readonly [string, () => TReadouts[TKey], Expected<Effect.Success<NoInfer<TReadouts[TKey]>>>];
	},
): Effect.fn.Return<void, Effect.Error<TReadouts[number]>, Effect.Services<TReadouts[number]>>;
function* check(rows: readonly (readonly [string, () => AnyReadout, unknown])[]) {
	const actual: Record<string, unknown>[] = [];
	const expected: Record<string, unknown>[] = [];
	for (const [label, readout, value] of rows) {
		actual.push({ [label]: yield* Effect.suspend(readout) });
		expected.push({ [label]: value });
	}
	expect(actual).toMatchObject(expected);
}
