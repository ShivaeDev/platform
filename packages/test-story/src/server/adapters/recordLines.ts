import { createInterface } from "node:readline";
import type { Readable } from "node:stream";
import * as Effect from "effect/Effect";
import { recordedSignals } from "#server/recordedSignals.ts";

export const recordLines = Effect.fnUntraced(function* (output: Readable) {
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
	return signals;
});
