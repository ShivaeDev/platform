import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

export const jobDatabase = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const context = yield* Effect.context<never>();
	return {
		executeSql: (text: string, values?: unknown[]) =>
			Effect.runPromise(
				sql.unsafe(text, values).pipe(
					Effect.provide(context),
					Effect.map((rows) => ({ rows: [...rows] })),
				),
			),
	};
});
