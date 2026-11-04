import { Effect, Layer } from "effect";
import { Backend } from "@shivaedev/agent/backend.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { backend } from "#adapters/backend.ts";
import { census } from "#adapters/census.ts";
import { configuredBackend } from "#adapters/configuredBackend.ts";
import { initializeCodex } from "#adapters/initializeCodex.ts";
import { CodexConfig } from "#config.ts";
export const Codex = defineService({
	id: "@shivaedev/agent-codex/Codex",
	initialize: initializeCodex,
	methods: (state) => ({ backend: backend(state), census: census(state) }),
	requires: [CodexConfig],
});
export const codexLayer = Layer.effect(Backend)(Effect.flatMap(Codex, configuredBackend)).pipe(Layer.provideMerge(Codex.layer));
