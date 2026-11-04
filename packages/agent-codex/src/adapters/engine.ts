import { Effect } from "effect";
import { backend } from "#adapters/backend.ts";
import { census } from "#adapters/census.ts";
import { initializeEngine } from "#adapters/initializeEngine.ts";
import type { LineProcess } from "#adapters/process.ts";
import type { CodexConfiguration } from "#config.ts";

export const engine = Effect.fn("Codex.engine")(function* (config: CodexConfiguration, spawn?: () => LineProcess) {
	const state = yield* initializeEngine(config, spawn);
	return { backend: backend(state), census: census(state) };
});
