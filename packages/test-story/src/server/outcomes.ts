import { Effect } from "effect";
import { type DeeplyAllowMatchers, expect } from "vitest";

type AnyReadout = Effect.Effect<unknown, unknown, unknown>;

export const outcomes = Effect.fn("Story.outcomes")(check);

function check<TReadouts extends Record<string, AnyReadout>>(
	rows: {
		readonly [TKey in keyof TReadouts]: readonly [TReadouts[TKey], DeeplyAllowMatchers<Effect.Success<NoInfer<TReadouts[TKey]>>>];
	},
): Effect.fn.Return<void, Effect.Error<TReadouts[keyof TReadouts]>, Effect.Services<TReadouts[keyof TReadouts]>>;
function* check(rows: Readonly<Record<string, readonly [AnyReadout, unknown]>>) {
	const actual: Record<string, unknown> = {};
	const expected: Record<string, unknown> = {};
	for (const [label, [readout, value]] of Object.entries(rows)) {
		actual[label] = yield* readout;
		expected[label] = value;
	}
	expect(actual).toEqual(expected);
}
