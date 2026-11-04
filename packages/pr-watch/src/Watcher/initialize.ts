import { Effect } from "effect";
import { commit } from "#Watcher/commit.ts";
import { observe } from "#Watcher/observe.ts";
import { targets } from "#Watcher/targets.ts";

export const initializeWatcher = Effect.gen(function* () {
	return { commit: yield* commit, observe: yield* observe, targets: yield* targets };
});
export type WatcherState = Effect.Success<typeof initializeWatcher>;
