import type { Effect } from "effect";
import type { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import type { FleetHealth } from "#diagnostics/health.ts";
import type { Folder } from "./board.ts";

export interface BoardFixtureOptions {
	readonly afterRead?: (url: string) => Effect.Effect<void, InternalServerError>;
	readonly beforeRead?: (kind: "document", url: string) => Effect.Effect<void, InternalServerError>;
	readonly beforeRequest?: (files: readonly string[]) => Effect.Effect<void, InternalServerError>;
	readonly beforeStart?: Effect.Effect<void>;
	readonly fleet?: FleetItemsProjection;
	readonly fleetHealth?: FleetHealth;
	readonly fleetPort?: number;
	readonly home?: string | undefined;
	readonly modified?: ReadonlyMap<string, number>;
	readonly pullRequests?: string;
	readonly unreadable?: readonly string[];
	readonly workspace?: Folder;
	readonly writable?: boolean;
}
