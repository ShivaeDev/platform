import { Context, Effect } from "effect";
import type { Key } from "#keys.ts";

export interface RecordReadOptions {
	readonly inferred?: boolean;
}

export const ReadRecorder = Context.Reference<(keys: readonly Key[], options: RecordReadOptions) => Effect.Effect<void>>(
	"@shivaedev/changes/ReadRecorder",
	{ defaultValue: () => () => Effect.void },
);

export const recordRead = Effect.fn("ReadRecorder.recordRead")(function* (keys: readonly Key[], options: RecordReadOptions = {}) {
	const record = yield* ReadRecorder;
	yield* record(keys, options);
});
