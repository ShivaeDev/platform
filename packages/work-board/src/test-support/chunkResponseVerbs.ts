import { Effect } from "effect";
import { act } from "react";
import { readingSettles } from "./readingSettle.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";

export function chunkResponseVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	function current() {
		if (!engine.chunkResponse) {
			throw new Error("The story controls no chunk response");
		}
		return engine.chunkResponse;
	}
	return {
		chunkArrives: () =>
			Effect.gen(function* () {
				tell("the browser receives the held chunk response");
				yield* Effect.promise(() => act(current().release));
				yield* readingSettles(engine, tell);
			}),
		chunkFails: () =>
			Effect.gen(function* () {
				tell("the browser fails the held chunk response");
				yield* Effect.promise(() => act(async () => current().fail()));
				yield* screenSettles(engine, tell);
			}),
	};
}
