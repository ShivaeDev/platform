import { Context, type Effect, type PubSub } from "effect";
import type { BackendFailure, ReadFailure } from "@shivaedev/agent/failures.ts";
import type { OpencodeRequest } from "#OpencodeRequest.ts";
import type { ToolSessions } from "#toolSessions.ts";

export interface ProviderPort {
	readonly exited: Effect.Effect<void>;
	readonly frames: PubSub.PubSub<unknown>;
	readonly get: (request: OpencodeRequest) => Effect.Effect<unknown, ReadFailure>;
	readonly post: (request: OpencodeRequest) => Effect.Effect<unknown, BackendFailure>;
	readonly tools: ToolSessions;
}

export class Provider extends Context.Service<Provider, ProviderPort>()("@shivaedev/agent-opencode/Provider") {}
