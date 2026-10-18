import { Deferred, Effect } from "effect";
import { act } from "react";
import type { BoardFixtureOptions } from "./inMemoryBoard.ts";
import { indexAvailability } from "./screenAvailability.tsx";
import type { ScreenEngine } from "./screenEngine.ts";

export function screenOptions(engine: ScreenEngine, options?: BoardFixtureOptions) {
	const configured = {
		...options,
		beforeIndex: () => indexAvailability(engine),
		beforeRead: (kind: "document", url: string) => {
			engine.documentReads.push(url);
			return engine.documentFailed ? Effect.die("Read unavailable") : (options?.beforeRead?.(kind, url) ?? Effect.void);
		},
		...(engine.fleet ? { fleet: engine.fleet } : {}),
	};
	if (!engine.heldRead) {
		return configured;
	}
	const read = engine.heldRead;
	return {
		...configured,
		beforeRead: (kind: "document", url: string) => {
			const available = configured.beforeRead(kind, url);
			if (url !== read.url) {
				return available;
			}
			return available.pipe(
				Effect.andThen(
					Effect.sync(() => {
						read.started = true;
					}),
				),
				Effect.andThen(Deferred.await(read.gate)),
			);
		},
	};
}
export function screenReadVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	return {
		readDocumentReads: () => {
			tell("the reader inspects document read requests");
			return [...engine.documentReads];
		},
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
