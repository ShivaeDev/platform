import { Effect } from "effect";
import type { Options } from "#model.ts";
import { StateFile } from "#state-file/service.ts";

export const load = Effect.fn("Watcher.load")(function* (options: Options) {
	const file = yield* StateFile;
	return yield* file.load(options.stateFile, options.repository);
});
