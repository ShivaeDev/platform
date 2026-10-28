import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { makeConflictClause } from "#makeConflictClause.ts";
import type { Comparisons, FindManyFilter } from "#repositoryFilter.ts";
import type { RepositoryChanges } from "./repositoryChanges.ts";
import { makeUpsertDecoder, type UpsertRow, upsertReturning } from "./upsertResult.ts";

type Fields<TModel extends Model.Any> = Schema.Struct.Type<TModel["fields"]>;
interface Incoming<TModel extends Model.Any, TValue> {
	readonly excluded: {
		[TKey in keyof Fields<TModel>]: [Fields<TModel>[TKey]] extends [TValue] ? TKey : never;
	}[keyof Fields<TModel>];
}
export type UpsertFilter<TModel extends Model.Any> = {
	readonly [TKey in keyof Fields<TModel>]?:
		| FindManyFilter<TModel>[TKey]
		| Incoming<TModel, Fields<TModel>[TKey]>
		| Comparisons<Fields<TModel>[TKey], NonNullable<Fields<TModel>[TKey]> | Incoming<TModel, NonNullable<Fields<TModel>[TKey]>>>;
};
export type UpsertResult<TRow> =
	| { readonly _tag: "Inserted"; readonly row: TRow; readonly inserted: true }
	| { readonly _tag: "Updated"; readonly row: TRow; readonly inserted: false }
	| { readonly _tag: "Unchanged" };
export interface ConditionalUpsert<TModel extends Model.Any, TOptions, TServices> {
	(
		input: TModel["insert"]["Type"],
		options: TOptions & { readonly updateWhere: UpsertFilter<TModel> },
	): Effect.Effect<
		UpsertResult<TModel["Type"]>,
		SqlError | Schema.SchemaError,
		TServices | TModel["fields"][keyof TModel["fields"]]["EncodingServices"]
	>;
	(
		input: TModel["insert"]["Type"],
		options: TOptions & { readonly updateWhere?: never },
	): Effect.Effect<UpsertRow<TModel["Type"]>, SqlError | Schema.SchemaError, TServices>;
}
export interface ConditionalUpsertMany<TModel extends Model.Any, TOptions, TServices> {
	(
		inputs: readonly TModel["insert"]["Type"][],
		options: TOptions & { readonly updateWhere: UpsertFilter<TModel> },
	): Effect.Effect<
		UpsertResult<TModel["Type"]>[],
		SqlError | Schema.SchemaError,
		TServices | TModel["fields"][keyof TModel["fields"]]["EncodingServices"]
	>;
	(
		inputs: readonly TModel["insert"]["Type"][],
		options: TOptions & { readonly updateWhere?: never },
	): Effect.Effect<UpsertRow<TModel["Type"]>[], SqlError | Schema.SchemaError, TServices>;
}

export function makeConditionalUpsert(
	model: Model.Any,
	sql: SqlClient.SqlClient,
	options: {
		readonly tableName: string;
		readonly spanPrefix: string;
		readonly changes: RepositoryChanges;
		readonly conflictColumns: readonly string[];
		readonly conflictWhere?: Readonly<Record<string, unknown>>;
		readonly idColumns: readonly string[];
	},
) {
	const encode = Schema.encodeEffect(model.insert);
	const record = Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Unknown));
	const decode = makeUpsertDecoder(model);
	const clause = makeConflictClause(model, sql, options);
	return (
		inputs: readonly unknown[],
		settings: { readonly updateColumns: readonly string[]; readonly updateWhere: Readonly<Record<string, unknown>> },
	) =>
		Effect.gen(function* () {
			const statements = yield* Effect.forEach(inputs, (input) =>
				Effect.gen(function* () {
					const row = yield* record(yield* encode(input));
					const suffix = yield* clause(row, settings.updateColumns, settings.updateWhere);
					return sql`insert into ${sql(options.tableName)} ${sql.insert(row)} ${suffix} returning ${options.changes.returning(upsertReturning(sql))}`;
				}),
			);
			const changedRows: Readonly<Record<string, unknown>>[] = [];
			const results = yield* Effect.forEach(statements, (statement) =>
				Effect.gen(function* () {
					const rows = yield* statement;
					changedRows.push(...rows);
					const row = rows[0];
					if (row === undefined) {
						return { _tag: "Unchanged" } as const;
					}
					const result = yield* decode(row);
					return result.inserted
						? ({ ...result, _tag: "Inserted", inserted: true } as const)
						: ({ ...result, _tag: "Updated", inserted: false } as const);
				}),
			);
			yield* options.changes.record(changedRows);
			return results;
		}).pipe(options.changes.write, Effect.withSpan(`${options.spanPrefix}.conditionalUpsert`));
}
