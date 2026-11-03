import type { Readable } from "node:stream";
import * as Effect from "effect/Effect";
import { recordLines } from "#server/adapters/recordLines.ts";
import { type UntilOptions, until } from "#server/until.ts";

export const lineSignals = Effect.fnUntraced(function* (output: Readable) {
	const signals = yield* recordLines(output);
	return {
		get lines(): readonly string[] {
			return signals.values.slice();
		},
		untilLine: (matches: (line: string) => boolean, options: UntilOptions) => until(signals.stream, matches, options),
	};
});
