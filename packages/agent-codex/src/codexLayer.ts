import { Layer } from "effect";
import { Backend } from "@shivaedev/agent/backend.ts";
import { configuredBackend } from "#adapters/configuredBackend.ts";
import { codexEngineLayer } from "#adapters/engine.ts";
import { Codex } from "#codex/service.ts";

export const codexLayer = Layer.effect(Backend)(configuredBackend()).pipe(Layer.provideMerge(Codex.layer), Layer.provide(codexEngineLayer));
