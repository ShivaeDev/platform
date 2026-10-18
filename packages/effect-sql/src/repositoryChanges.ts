import { Effect, Option } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { invalidateOnCommit, transact } from "./transact.ts";

export type RepositoryChanges = Effect.Success<ReturnType<typeof repositoryChanges>>;

export const repositoryChanges = Effect.fnUntraced(function* (sql: SqlClient.SqlClient, table: string, columns: readonly string[]) {
	const initial = yield* Effect.serviceOption(Reactivity.Reactivity);
	const fallback = Option.isSome(initial) ? initial.value : yield* Reactivity.make;
	function provide<A, E, R>(effect: Effect.Effect<A, E, R | Reactivity.Reactivity | SqlClient.SqlClient>) {
		return Effect.flatMap(Effect.serviceOption(Reactivity.Reactivity), (current) =>
			effect.pipe(
				Effect.provideService(SqlClient.SqlClient, sql),
				Effect.provideService(
					Reactivity.Reactivity,
					Option.getOrElse(current, () => fallback),
				),
			),
		);
	}
	function record(rows: readonly Readonly<Record<string, unknown>>[]) {
		if (rows.length === 0) {
			return Effect.void;
		}
		const ids = rows.map((row) => (columns.length === 1 ? row[columns[0] ?? ""] : JSON.stringify(columns.map((column) => row[column]))));
		return provide(invalidateOnCommit({ [table]: ids }));
	}
	function write<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return provide(transact(effect, { onSqlError: (error) => error }));
	}
	return { record, write };
});
