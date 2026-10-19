import type { Effect } from "effect";
import type { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import type { Server } from "#rpc/Server.ts";

export interface HandlerOptions {
	readonly fleetFolder?: string;
	readonly fleetPort?: number | null;
	readonly server?: Effect.Effect<typeof Server.Type, ServiceUnavailable>;
}
