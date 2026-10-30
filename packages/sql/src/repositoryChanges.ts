import { Effect, Option, type Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { declaredBuckets } from "@shivaedev/changes/buckets.ts";
import { compositeId, invalidationKeys, type Key, recordKey } from "@shivaedev/changes/keys.ts";
import { ChangeDeclarations } from "#ChangeDeclarations.ts";
import { invalidateOnCommit, transact } from "#transact.ts";

export type RepositoryChanges = Effect.Success<ReturnType<typeof repositoryChanges>>;

export const repositoryChanges = Effect.fnUntraced(function* (
	sql: SqlClient.SqlClient,
	table: string,
	columns: readonly string[],
	fields: Schema.Struct.Fields = {},
) {
	const buckets = declaredBuckets(fields);
	const bucketKeys = Effect.fnUntraced(function* (row: Readonly<Record<string, unknown>>) {
		const keys: Key[] = [];
		for (const [index, { field, decode }] of buckets.entries()) {
			for (const value of [row[field], row[`shivaeOldBucket${index}`]]) {
				if (value === null || value === undefined) {
					continue;
				}
				const decoded = yield* decode(value);
				if (decoded === null || decoded === undefined) {
					continue;
				}
				keys.push({ _tag: "Bucket", collection: table, field, value: decoded });
			}
		}
		return invalidationKeys(keys);
	});
	function returning(base = sql`*`) {
		return sql.csv([base, ...buckets.map(({ field }, index) => sql`old.${sql(field)} as ${sql(`shivaeOldBucket${index}`)}`)]);
	}
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
	const record = Effect.fnUntraced(function* (rows: readonly Readonly<Record<string, unknown>>[]) {
		if (rows.length === 0) {
			return;
		}
		const keys = new Set<string>([table]);
		for (const row of rows) {
			const id = columns.length === 1 ? row[columns[0] ?? ""] : compositeId(columns.map((column) => row[column]));
			keys.add(recordKey(table, id));
			for (const key of yield* bucketKeys(row)) {
				keys.add(key);
			}
		}
		const declarations = yield* ChangeDeclarations;
		yield* declarations.declare(table, [...keys], rows.length);
		yield* provide(invalidateOnCommit([...keys]));
	});
	function write<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return provide(transact(effect, { onSqlError: (error) => error }));
	}
	return { record, returning, write };
});
