import { Context, Effect } from "effect";
import type { SqlClient } from "effect/sql";

export const TransactionCheckpoint = Context.Reference<Effect.Effect<Effect.Effect<void>, never, SqlClient.SqlClient>>(
	"@shivaedev/effect-sql/TransactionCheckpoint",
	{ defaultValue: () => Effect.succeed(Effect.void) },
);
