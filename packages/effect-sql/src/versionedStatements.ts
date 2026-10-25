import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import { makeConflictClause } from "#makeConflictClause.ts";
import type { OptimisticConcurrencyError } from "#repository.ts";

const Version = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
export interface VersionedOptions {
	readonly conflict: (id: unknown, expectedVersion: number, reason: "missing" | "stale") => OptimisticConcurrencyError;
	readonly conflictColumns?: readonly string[];
	readonly conflictWhere?: Readonly<Record<string, unknown>>;
	readonly idColumns: readonly string[];
	readonly tableName: string;
	readonly versionColumn: string;
}

export function versionedStatements(model: Model.Any, sql: SqlClient.SqlClient, options: VersionedOptions) {
	const { tableName, idColumns, versionColumn, conflict } = options;
	const fields = Object.fromEntries(
		idColumns.map((column) => {
			const field = model.fields[column];
			if (field === undefined) {
				throw new Error(`Unknown ID column: ${column}`);
			}
			return [column, field];
		}),
	);
	const encodeKey = Schema.encodeEffect(Schema.Struct(fields));
	const versionSchema = model.fields[versionColumn];
	if (versionSchema === undefined) {
		throw new Error(`Unknown version column: ${versionColumn}`);
	}
	const encodeVersion = Schema.encodeEffect(versionSchema);
	const encodeInsert = Schema.encodeEffect(model.insert);
	const encodeUpdate = Schema.encodeEffect(model.update);
	const record = Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Unknown));
	const validateVersion = Schema.decodeUnknownEffect(Version);
	const clause =
		options.conflictColumns === undefined ? undefined : makeConflictClause(model, sql, { ...options, conflictColumns: options.conflictColumns });
	const returningKeys = sql.csv(idColumns.map((column) => sql`${sql(column)}`));
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
	function update(input: Readonly<Record<string, unknown>>) {
		return Effect.gen(function* () {
			const encoded = yield* record(yield* encodeUpdate(input));
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
	return { insert, remove, returningKeys, update };
}
