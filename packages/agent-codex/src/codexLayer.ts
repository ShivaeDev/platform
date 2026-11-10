import { Layer } from "effect";
import { Backend } from "@shivaedev/agent/backend.ts";
import { Codex } from "#codex/service.ts";
import { configuredBackend } from "#configuredBackend.ts";
import { codexEngineLayer } from "#engine.ts";

export const codexLayer = Layer.effect(Backend)(configuredBackend()).pipe(Layer.provideMerge(Codex.layer), Layer.provide(codexEngineLayer));
