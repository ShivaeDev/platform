import { Effect, Option, type Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { declaredBuckets, decodeBucketValue } from "@shivaedev/changes/buckets.ts";
import { collectionInvalidationKeys, compositeId, type Identity, invalidationKeys, type Key, recordKey } from "@shivaedev/changes/keys.ts";
import { ChangeDeclarations } from "#ChangeDeclarations.ts";
import { invalidateOnCommit, transact } from "#transact.ts";

export type RepositoryChanges = Effect.Success<ReturnType<typeof repositoryChanges>>;

export const repositoryChanges = Effect.fnUntraced(function* (
	table: string,
	columns: readonly string[],
	fields: Schema.Struct.Fields = {},
	tuples: Readonly<Record<string, readonly string[]>> = {},
) {
	const sql = yield* SqlClient.SqlClient;
	const declared = [
		...declaredBuckets(fields).map(({ field }) => ({ columns: [field], field, tuple: false })),
		...Object.entries(tuples).map(([field, tupleColumns]) => ({ columns: tupleColumns, field, tuple: true })),
	];
	const columnParts = new Map(
		[...new Set(declared.flatMap((bucket) => bucket.columns))].flatMap((column, index) => {
			const schema = fields[column];
			return schema === undefined ? [] : [[column, { column, decode: decodeBucketValue(schema), old: `shivaeOldBucket${index}` }] as const];
		}),
	);
	const buckets = declared.map((bucket) => ({ ...bucket, parts: bucket.columns.flatMap((column) => columnParts.get(column) ?? []) }));
	const bucketValue = Effect.fnUntraced(function* (
		row: Readonly<Record<string, unknown>>,
		{ parts, tuple }: (typeof buckets)[number],
		side: "column" | "old",
	) {
		const values: Identity[] = [];
		for (const part of parts) {
			const stored = row[part[side]];
			const decoded = stored === null || stored === undefined ? undefined : yield* part.decode(stored);
			if (decoded === null || decoded === undefined) {
				return undefined;
			}
			values.push(decoded);
		}
		return tuple ? compositeId(values) : values[0];
	});
	const bucketKeys = Effect.fnUntraced(function* (row: Readonly<Record<string, unknown>>) {
		const keys: Key[] = [];
		for (const bucket of buckets) {
			for (const side of ["column", "old"] as const) {
				const value = yield* bucketValue(row, bucket, side);
				if (value !== undefined) {
					keys.push({ _tag: "Bucket", collection: table, field: bucket.field, value });
				}
			}
		}
		return invalidationKeys(keys);
	});
	function returning(base = sql`*`) {
		return sql.csv([base, ...[...columnParts.values()].map(({ column, old }) => sql`old.${sql(column)} as ${sql(old)}`)]);
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
		return provide(transact(effect));
	}
	const recordTable = Effect.fnUntraced(function* (rows: number) {
		if (rows === 0) {
			return;
		}
		const declarations = yield* ChangeDeclarations;
		const keys = collectionInvalidationKeys(table);
		yield* declarations.declare(table, keys, rows);
		yield* provide(invalidateOnCommit(keys));
	});
	return { record, recordTable, returning, write };
});
