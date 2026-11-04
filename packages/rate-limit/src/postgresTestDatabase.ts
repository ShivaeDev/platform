import { Duration, Effect } from "effect";
import { SqlClient } from "effect/sql";

export const postgresTestDatabase = Effect.gen(function* () {
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
	return {
		elapseWindows: (duration: Duration.Input) =>
			sql`update rate_limit_windows set expires_at = expires_at - ${Duration.toMillis(Duration.fromInputUnsafe(duration))}`.pipe(Effect.asVoid),
		expireWindows: sql`update rate_limit_windows set expires_at = 0`.pipe(Effect.asVoid),
	};
});
