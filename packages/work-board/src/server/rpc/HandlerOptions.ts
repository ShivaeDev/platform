import type { Effect } from "effect";
import type { Document } from "#browser/document/schema.ts";
import type { Changes } from "#server/files/changes.ts";
import type { Snapshot } from "#server/search/snapshot.ts";

export interface HandlerOptions {
	readonly changes: Changes;
	readonly document?: (url: string) => Effect.Effect<Document, unknown>;
	readonly fleetPort?: number | null;
	readonly home: string | undefined;
	readonly index: Effect.Effect<Snapshot, unknown>;
	readonly writable?: boolean;
}
