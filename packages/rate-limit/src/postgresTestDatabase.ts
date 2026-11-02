import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export const postgresTestDatabase = Effect.gen(function* () {
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
	return {
		expireWindows: sql`update rate_limit_windows set expires_at = 0`.pipe(Effect.asVoid),
	};
});
