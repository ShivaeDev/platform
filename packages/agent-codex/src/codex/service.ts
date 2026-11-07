import { Effect } from "effect";
import { defineService } from "@shivaedev/service/adapters/defineService.ts";
import { CodexEngine } from "#adapters/engine.ts";
import { backend } from "#codex/backend.ts";
import { census } from "#codex/census.ts";

export const Codex = defineService({
	id: "@shivaedev/agent-codex/Codex",
	initialize: Effect.void,
	methods: () => ({ backend, census }),
	requires: [CodexEngine],
});
