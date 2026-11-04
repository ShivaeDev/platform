import { Effect, Layer } from "effect";
import { Backend } from "@shivaedev/agent/backend.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { engine } from "#adapters/engine.ts";
import { CodexConfig } from "#config.ts";
export const Codex = defineService({
	id: "@shivaedev/agent-codex/Codex",
	initialize: Effect.gen(function* () {
		const config = yield* CodexConfig;
		return yield* engine(config);
	}),
	methods: (state) => state,
	requires: [CodexConfig],
});
export const codexLayer = Layer.effect(Backend)(Effect.flatMap(Codex, (codex) => codex.backend())).pipe(Layer.provideMerge(Codex.layer));
