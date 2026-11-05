import { Context, type Effect } from "effect";

export class PostgresChangeResync extends Context.Service<PostgresChangeResync, { readonly resync: Effect.Effect<number> }>()(
	"@shivaedev/sql/PostgresChangeResync",
) {}
