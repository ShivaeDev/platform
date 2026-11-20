import { Effect } from "effect";
import { BackendUnavailable } from "@shivaedev/agent/failures.ts";
export const loadClaudeSdk = Effect.tryPromise({
	catch: (error) => new BackendUnavailable({ backend: "claude-code", message: String(error) }),
	try: () => import("@anthropic-ai/claude-agent-sdk"),
});
