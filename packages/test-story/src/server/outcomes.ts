import * as Effect from "effect/Effect";
import { assertOutcomes, type Expected } from "#server/adapters/assertOutcomes.ts";

type AnyReadout = Effect.Effect<unknown, unknown, unknown>;

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
	yield* assertOutcomes(actual, expected);
}
