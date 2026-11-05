import { Effect } from "effect";
import { GitHub } from "#github/service.ts";

export const pacing = Effect.fn("Watcher.pacing")(function* (interval: number) {
	const github = yield* GitHub;
	return yield* github.pacing(interval);
});
