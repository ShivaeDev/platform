import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeConflictClause } from "#makeConflictClause.ts";
import type { OptimisticConcurrencyError } from "#repository.ts";
import { selectedUpdate } from "#repositoryUpdate.ts";
import { sqlNameTransforms } from "#sqlNameTransforms.ts";
import { storageSchema } from "#storageSchema.ts";

const Version = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
export interface VersionedOptions {
	readonly conflict: (id: unknown, expectedVersion: number, reason: "missing" | "stale") => OptimisticConcurrencyError;
	readonly conflictColumns?: readonly string[];
	readonly conflictWhere?: Readonly<Record<string, unknown>>;
	readonly idColumns: readonly string[];
	readonly tableName: string;
	readonly versionColumn: string;
}

export const versionedStatements = Effect.fnUntraced(function* (model: Model.Any, options: VersionedOptions) {
	const sql = yield* SqlClient.SqlClient;
	const nameTransforms = yield* sqlNameTransforms;
	const { tableName, idColumns, versionColumn, conflict } = options;
	const entries: [string, Schema.Constraint][] = [];
	for (const column of idColumns) {
		const field = model.fields[column];
		if (field === undefined) {
			return yield* Effect.die(new Error(`Unknown ID column: ${column}`));
		}
		entries.push([column, field]);
	}
	const encodeKey = Schema.encodeEffect(Schema.Struct(Object.fromEntries(entries)));
	const versionSchema = model.fields[versionColumn];
	if (versionSchema === undefined) {
		return yield* Effect.die(new Error(`Unknown version column: ${versionColumn}`));
	}
	const encodeVersion = Schema.encodeEffect(versionSchema);
	const encodeInsert = Schema.encodeEffect(storageSchema(model.insert, model.fields, nameTransforms));
	const encodeUpdate = Schema.encodeEffect(storageSchema(model.update, model.fields, nameTransforms));
	const record = Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Unknown));
	const validateVersion = Schema.decodeUnknownEffect(Version);
	const clause =
		options.conflictColumns === undefined ? undefined : yield* makeConflictClause(model, { ...options, conflictColumns: options.conflictColumns });
	function key(input: unknown) {
		return idColumns.length === 1 ? { [idColumns[0] ?? ""]: input } : input;
	}
	function inputKey(input: Readonly<Record<string, unknown>>) {
		return idColumns.length === 1 ? input[idColumns[0] ?? ""] : Object.fromEntries(idColumns.map((column) => [column, input[column]]));
	}
	function predicate(encoded: Readonly<Record<string, unknown>>) {
		return sql.and(idColumns.map((column) => sql`${sql(column)} = ${encoded[column]}`));
	}
	function classify(id: unknown, encoded: Readonly<Record<string, unknown>>, expected: number) {
		return Effect.gen(function* () {
			const rows = yield* sql`select 1 from ${sql(tableName)} where ${predicate(encoded)}`;
			return yield* Effect.fail(conflict(id, expected, rows.length === 0 ? "missing" : "stale"));
		});
	}
	function insert(input: unknown, ignore = false) {
		return Effect.gen(function* () {
			const encoded = { ...(yield* record(yield* encodeInsert(input))), [versionColumn]: 0 };
			const suffix = ignore && clause !== undefined ? yield* clause(encoded) : sql``;
			return sql`insert into ${sql(tableName)} ${sql.insert(encoded)} ${suffix}`;
		});
	}
	function update(input: Readonly<Record<string, unknown>>, columns?: readonly string[]) {
		return Effect.gen(function* () {
			const encoded = yield* record(
				yield* columns === undefined
					? encodeUpdate(input)
					: Effect.flatMap(selectedUpdate(model, columns, [...idColumns, versionColumn], input), (schema) =>
							Schema.encodeEffect(storageSchema(schema, model.fields, nameTransforms))(input),
						),
			);
			const expectedVersion = yield* validateVersion(encoded[versionColumn]);
			const assignments = Object.entries(encoded).filter(([column]) => !idColumns.includes(column) && column !== versionColumn);
			const set = sql.csv([
				...assignments.map(([column, value]) => sql`${sql(column)} = ${value}`),
				sql`${sql(versionColumn)} = ${sql(versionColumn)} + 1`,
			]);
			return {
				classify: () => classify(inputKey(input), encoded, expectedVersion),
				statement: sql`update ${sql(tableName)} set ${set} where ${predicate(encoded)} and ${sql(versionColumn)} = ${expectedVersion}`,
			};
		});
	}
	function remove(id: unknown, expected: number) {
		return Effect.gen(function* () {
			const expectedVersion = yield* validateVersion(yield* encodeVersion(expected));
			const yieldedKey = yield* record(key(id));
			const encoded = yield* record(yield* encodeKey(yieldedKey));
			return {
				classify: () => classify(inputKey(yieldedKey), encoded, expectedVersion),
				statement: sql`delete from ${sql(tableName)} where ${predicate(encoded)} and ${sql(versionColumn)} = ${expectedVersion}`,
			};
		});
	}
	return { insert, remove, update };
});
