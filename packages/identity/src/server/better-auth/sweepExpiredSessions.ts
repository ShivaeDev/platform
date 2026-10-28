import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";

const SweepResult = Schema.Tuple([Schema.Struct({ removed: Schema.NumberFromString })]);

export const sweepExpiredSessions = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const rows = yield* sql`with expired as (
		delete from "session" where "expiresAt" <= now() returning 1
	) select count(*)::text as removed from expired`;
	const [result] = yield* Schema.decodeUnknownEffect(SweepResult)(rows);
	return result.removed;
}).pipe(Effect.withSpan("Identity.sweepExpiredSessions"));
