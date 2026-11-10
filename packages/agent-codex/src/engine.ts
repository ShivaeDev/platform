import { Context, type Effect, Layer } from "effect";
import { initializeCodex } from "#initializeCodex.ts";

export class CodexEngine extends Context.Service<CodexEngine, Effect.Success<typeof initializeCodex>>()("@shivaedev/agent-codex/CodexEngine") {}

export const codexEngineLayer = Layer.effect(CodexEngine)(initializeCodex);
