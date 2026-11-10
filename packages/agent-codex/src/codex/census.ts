import { Effect } from "effect";
import { CodexEngine } from "#engine.ts";

export const census = Effect.fn("Codex.census")(function* (rootThreadId: string) {
	const engine = yield* CodexEngine;
	return yield* engine.census(rootThreadId);
});
