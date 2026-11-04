import { Clock, Effect } from "effect";
import { Statement } from "effect/sql";

export function withDatabaseClock<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.provideService(effect, Statement.CurrentTransformer, (statement, sql) =>
		Effect.gen(function* () {
			const [query, params] = statement.compile();
			if (!/\b(?:clock_timestamp|now)\(\)/u.test(query)) {
				return statement;
			}
			const now = new Date(yield* Clock.currentTimeMillis).toISOString();
			// PostgreSQL rejects parameters in DEFAULT clauses; the ISO value comes only from the kit's clock.
			return sql.unsafe(query.replaceAll(/\b(?:clock_timestamp|now)\(\)/gu, `'${now}'::timestamptz`), params);
		}),
	);
}
