import { Effect } from "effect";
import type { State } from "#model.ts";
import { StateFile } from "#state-file/service.ts";

export const save = Effect.fn("Watcher.save")(function* (path: string, state: State) {
	const file = yield* StateFile;
	yield* file.save(path, state);
});
