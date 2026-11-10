import { Effect } from "effect";
import { CodexEngine } from "#engine.ts";

export const backend = Effect.fn("Codex.backend")(function* () {
	const engine = yield* CodexEngine;
	return engine.backend;
});
