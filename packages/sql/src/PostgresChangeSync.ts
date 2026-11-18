import { Context, type Effect } from "effect";
import type { SyncToken } from "@shivaedev/changes/syncToken.ts";

export class PostgresChangeSync extends Context.Service<PostgresChangeSync, { readonly synced: (token: SyncToken) => Effect.Effect<void> }>()(
	"@shivaedev/sql/PostgresChangeSync",
) {}
