import { Deferred, Effect } from "effect";
import type { BoardFixtureOptions } from "./inMemoryBoard.ts";
import type { ScreenEngine } from "./screenEngine.ts";

export function screenOptions(engine: ScreenEngine, options?: BoardFixtureOptions) {
	if (!engine.heldRead) {
		return options;
	}
	const read = engine.heldRead;
	return {
		...options,
		beforeRead: (kind: "document", url: string) => {
			if (url !== read.url) {
				return options?.beforeRead?.(kind, url) ?? Effect.void;
			}
			return Effect.sync(() => {
				read.started = true;
			}).pipe(Effect.andThen(Deferred.await(read.gate)));
		},
		home: options?.home,
	};
}
export function screenReadVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	return {
		readStarted: () => engine.heldRead?.started ?? false,
		releaseRead: () => {
			const read = engine.heldRead;
			if (!read) {
				throw new Error("The story has no paused document read");
			}
			tell(`the document read for ${read.url} resumes`);
			Effect.runSync(Deferred.succeed(read.gate, undefined));
		},
	};
}
