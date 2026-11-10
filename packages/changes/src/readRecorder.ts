import { Context, Effect } from "effect";
import type { Key } from "#keys.ts";

export const ReadRecorder = Context.Reference<(keys: readonly Key[]) => Effect.Effect<void>>("@shivaedev/changes/ReadRecorder", {
	defaultValue: () => () => Effect.void,
});

export const recordRead = Effect.fn("ReadRecorder.recordRead")(function* (keys: readonly Key[]) {
	const record = yield* ReadRecorder;
	yield* record(keys);
});
