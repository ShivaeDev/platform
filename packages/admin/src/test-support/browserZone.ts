import { Effect } from "effect";
import { vi } from "vitest";

export const browserZone = Effect.fnUntraced(function* (timeZone: string) {
	// happy-dom takes Intl from Node, whose default time zone follows TZ, so this is the browser's zone as a view sees it.
	vi.stubEnv("TZ", timeZone);
	yield* Effect.addFinalizer(() => Effect.sync(() => vi.unstubAllEnvs()));
});
