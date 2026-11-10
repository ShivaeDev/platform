import { Effect } from "effect";
import { backend } from "#backend.ts";
import { census } from "#census.ts";
import { CodexConfig } from "#config.ts";
import { initializeEngine } from "#initializeEngine.ts";

export const initializeCodex = Effect.gen(function* () {
	const config = yield* CodexConfig;
	const state = yield* initializeEngine(config);
	return { backend: backend(state), census: census(state) };
});
