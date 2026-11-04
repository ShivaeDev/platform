import type { Effect, Stream } from "effect";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import type { BackendUnavailable } from "@shivaedev/agent/failures.ts";
import type { Input } from "@shivaedev/agent/run.ts";

export interface SessionConnection {
	readonly events: Stream.Stream<RunEvent, BackendUnavailable>;
	readonly interrupt: Effect.Effect<void, BackendUnavailable>;
	readonly queue: (input: Input, priority?: "now") => Effect.Effect<void, BackendUnavailable>;
}
