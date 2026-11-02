import { Clock, Effect } from "effect";
import { DraftStorageProvider } from "#persistence.ts";

export const draftPersistence = Effect.gen(function* () {
	const storage = yield* DraftStorageProvider;
	const clock = yield* Clock.Clock;
	return { now: () => clock.currentTimeMillisUnsafe(), storage };
});
