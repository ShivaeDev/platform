import { Effect } from "effect";
import { GitHub } from "#github/service.ts";

export const delay = Effect.fn("Watcher.delay")(function* (interval: number) {
	const github = yield* GitHub;
	return yield* github.delay(interval);
});
