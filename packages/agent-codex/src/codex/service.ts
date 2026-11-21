import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { backend } from "#codex/backend.ts";
import { census } from "#codex/census.ts";
import { CodexEngine } from "#engine.ts";

export const Codex = defineService({
	id: "@shivaedev/agent-codex/Codex",
	initialize: Effect.void,
	methods: () => ({ backend, census }),
	requires: [CodexEngine],
});
