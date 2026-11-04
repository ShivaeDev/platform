import { Effect } from "effect";
import type { BackendFailure } from "@shivaedev/agent/failures.ts";
export function attempt<A, R>(effect: Effect.Effect<A, BackendFailure, R>) {
	return effect.pipe(
		Effect.catchTag("UnknownAcceptance", () => Effect.succeed("unknown acceptance")),
		Effect.catchTag("Rejected", (error) => Effect.succeed(error.message)),
		Effect.catchTag("BackendUnavailable", () => Effect.succeed("unavailable")),
	);
}
