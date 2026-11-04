import { Effect } from "effect";
import type { ConfiguredBackend } from "@shivaedev/agent/backend.ts";

export const configuredBackend = Effect.fn("Codex.configuredBackend")((codex: { readonly backend: () => Effect.Effect<ConfiguredBackend> }) =>
	codex.backend(),
);
