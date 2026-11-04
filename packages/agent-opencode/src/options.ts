import type { Effect, Option, Stream } from "effect";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import type { BackendFailure } from "@shivaedev/agent/failures.ts";
import type { Input, StartRequest } from "@shivaedev/agent/run.ts";
import type { DirectTool } from "#tools.ts";
export interface OpencodeOptions {
	readonly command?: string | undefined;
	readonly constrainedPrompt?: string | undefined;
	readonly cwd: string;
	readonly sessionTools?: (request: StartRequest) => readonly DirectTool[];
	readonly skills?: string | undefined;
	readonly tools?: readonly DirectTool[];
	readonly url?: string | undefined;
}
export interface OpenSessionOptions {
	readonly constrainedPrompt?: string | undefined;
	readonly cwd: string;
	readonly effort: Option.Option<string>;
	readonly model?: string | undefined;
	readonly resume: Option.Option<string>;
	readonly tools: readonly DirectTool[];
}
export interface SessionHandle {
	readonly events: Stream.Stream<RunEvent>;
	readonly interrupt: Effect.Effect<void, BackendFailure>;
	readonly nativeRef: Effect.Effect<Option.Option<string>>;
	readonly queue: (input: Input) => Effect.Effect<void, BackendFailure>;
	readonly steer: (input: Input) => Effect.Effect<void, BackendFailure>;
}
