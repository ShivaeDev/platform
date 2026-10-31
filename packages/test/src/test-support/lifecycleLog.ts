import { appendFileSync } from "node:fs";
import { Config, Effect } from "effect";

// A fixture test runs in another Vitest run, so it reports what happened through this log file.
export const LIFECYCLE_LOG = "TEST_LIFECYCLE_LOG";

export const note = Effect.fnUntraced(function* (event: string) {
	const log = yield* Config.String(LIFECYCLE_LOG).pipe(Effect.orDie);
	appendFileSync(log, `${event}\n`);
});

export function releasedOnClose(resource: string) {
	return Effect.addFinalizer(() => note(`released ${resource}`));
}
