import { Effect } from "effect";
import { backend } from "#adapters/backend.ts";
import { census } from "#adapters/census.ts";
import { initializeEngine } from "#adapters/initializeEngine.ts";
import { CodexConfig } from "#config.ts";

export const initializeCodex = Effect.gen(function* () {
	const config = yield* CodexConfig;
	const state = yield* initializeEngine(config);
	return { backend: backend(state), census: census(state) };
});
