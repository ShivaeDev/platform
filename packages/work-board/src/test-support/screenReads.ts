import { Deferred, Effect } from "effect";
import { act } from "react";
import type { BoardFixtureOptions } from "./inMemoryBoard.ts";
import { indexAvailability } from "./screenAvailability.tsx";
import type { ScreenEngine } from "./screenEngine.ts";

export function screenOptions(engine: ScreenEngine, options?: BoardFixtureOptions) {
	const configured = {
		beforeRead: (kind: "document", url: string) =>
			engine.documentFailed ? Effect.die("Read unavailable") : (options?.beforeRead?.(kind, url) ?? Effect.void),
		home: Object.keys(engine.files)[0],
		...options,
		beforeIndex: () => indexAvailability(engine),
		...(engine.fleet ? { fleet: engine.fleet } : {}),
	};
	if (!engine.heldRead) {
		return configured;
	}
	const read = engine.heldRead;
	return {
		...configured,
		beforeRead: (kind: "document", url: string) => {
			if (url !== read.url) {
				return options?.beforeRead?.(kind, url) ?? Effect.void;
			}
			return Effect.sync(() => {
				read.started = true;
			}).pipe(Effect.andThen(Deferred.await(read.gate)));
		},
	};
}
export function screenReadVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	return {
		readStarted: () => {
			tell("the reader checks whether the document read has started");
			return engine.heldRead?.started ?? false;
		},
		releaseRead: async () => {
			const read = engine.heldRead;
			if (!read) {
				throw new Error("The story has no paused document read");
			}
			tell(`the document read for ${read.url} resumes`);
			await act(() => Promise.resolve().then(() => Effect.runSync(Deferred.succeed(read.gate, undefined))));
		},
	};
}
