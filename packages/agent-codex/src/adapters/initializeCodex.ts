import { Effect } from "effect";
import { initializeEngine } from "#adapters/initializeEngine.ts";
import { CodexConfig } from "#config.ts";

export const initializeCodex = Effect.gen(function* () {
	const config = yield* CodexConfig;
	return yield* initializeEngine(config);
});
