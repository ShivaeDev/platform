import { createInterface } from "node:readline";
import type { Readable } from "node:stream";
import { Effect } from "effect";
import { recordedSignals } from "#internal/recordedSignals.ts";
import { type UntilOptions, until } from "#until.ts";

export const lineSignals = Effect.fnUntraced(function* (output: Readable) {
	const signals = recordedSignals<string, Error>();
	yield* Effect.acquireRelease(
		Effect.sync(() => {
			const reader = createInterface({ crlfDelay: Number.POSITIVE_INFINITY, input: output });
			reader.on("line", signals.push);
			reader.once("close", () => signals.end());
			reader.on("error", signals.end);
			return reader;
		}),
		(reader) => Effect.sync(() => reader.close()),
	);
	return {
		get lines(): readonly string[] {
			return signals.values.slice();
		},
		untilLine: (matches: (line: string) => boolean, options: UntilOptions) => until(signals.stream, matches, options),
	};
});
