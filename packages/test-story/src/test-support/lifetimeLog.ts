import { appendFileSync } from "node:fs";
import { Config, Effect, Option } from "effect";

// A story run by the story runner lives in another Vitest process, so it reports its lifetime through this log file.
export const LIFETIME_LOG = "TEST_STORY_LIFETIME_LOG";

export const noteLifetime = Effect.fnUntraced(function* (event: string) {
	const log = yield* Config.String(LIFETIME_LOG).pipe(Config.option, Effect.orDie);
	if (Option.isSome(log)) {
		appendFileSync(log.value, `${event}\n`);
	}
});

export function recordLifetime(event: string) {
	return noteLifetime(event).pipe(Effect.andThen(Effect.addFinalizer(() => noteLifetime(`${event} closed`))));
}
