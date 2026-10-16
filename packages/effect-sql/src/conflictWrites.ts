import { Effect, Option, Schema, SchemaAST, SchemaIssue } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";

export type InsertColumn<TModel extends Model.Any> = Extract<keyof TModel["insert"]["Type"] & keyof TModel["fields"], string>;
export type ConflictColumns<TModel extends Model.Any> = readonly [InsertColumn<TModel>, ...InsertColumn<TModel>[]];
export interface ConflictWrites<TModel extends Model.Any, TExcluded extends PropertyKey> {
	readonly insertOrIgnore: (
		input: TModel["insert"]["Type"],
	) => Effect.Effect<Option.Option<TModel["Type"]>, SqlError | Schema.SchemaError, TModel["insert"]["EncodingServices"] | TModel["DecodingServices"]>;
	readonly upsert: (
		input: TModel["insert"]["Type"],
		options: {
			readonly updateColumns: readonly [
				Exclude<InsertColumn<TModel> & keyof TModel["update"]["Type"], TExcluded>,
				...Exclude<InsertColumn<TModel> & keyof TModel["update"]["Type"], TExcluded>[],
			];
		},
	) => Effect.Effect<TModel["Type"], SqlError | Schema.SchemaError, TModel["insert"]["EncodingServices"] | TModel["DecodingServices"]>;
}

export function makeConflictWrites(
	model: Model.Any,
	sql: SqlClient.SqlClient,
	options: {
		readonly tableName: string;
		readonly spanPrefix: string;
		readonly conflictColumns: readonly string[];
		readonly idColumns: readonly string[];
	},
) {
	const { tableName, spanPrefix, conflictColumns, idColumns } = options;
	const encode = Schema.encodeEffect(model.insert);
	const decode = Schema.decodeUnknownEffect(model);
	const record = Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Unknown));
	const updateFields = SchemaAST.isObjects(model.update.ast) ? model.update.ast.propertySignatures.map((field) => field.name) : [];
	const immutable = Object.keys(model.fields).filter((column) => !updateFields.includes(column));
	function invalid(column: string) {
		return Effect.fail(new Schema.SchemaError(new SchemaIssue.Pointer([column], new SchemaIssue.UnexpectedKey(model.ast, column))));
	}
	function validateColumns(encoded: Readonly<Record<string, unknown>>, columns: readonly string[], excluded: readonly string[] = []) {
		return Effect.gen(function* () {
			if (columns.length === 0) {
				return yield* invalid("");
			}
			for (const column of columns) {
				if (!(Object.hasOwn(model.fields, column) && Object.hasOwn(encoded, column)) || excluded.includes(column)) {
					return yield* invalid(column);
				}
			}
		});
	}
	function statement(input: unknown, updateColumns?: readonly string[]) {
		return Effect.gen(function* () {
			const encoded = yield* record(yield* encode(input));
			yield* validateColumns(encoded, conflictColumns);
			if (updateColumns !== undefined) {
				yield* validateColumns(encoded, updateColumns, [...idColumns, ...conflictColumns, ...immutable]);
			}
			const conflict = sql.csv(conflictColumns.map((column) => sql`${sql(column)}`));
			const action =
				updateColumns === undefined
					? sql`do nothing`
					: sql`do update set ${sql.csv(updateColumns.map((column) => sql`${sql(column)} = excluded.${sql(column)}`))}`;
			return sql`insert into ${sql(tableName)} ${sql.insert(encoded)} on conflict (${conflict}) ${action} returning *`;
		});
	}
	return {
		insertOrIgnore: (input: unknown) =>
			Effect.gen(function* () {
				const rows = yield* yield* statement(input);
				return rows.length === 0 ? Option.none() : Option.some(yield* decode(rows[0]));
			}).pipe(Effect.withSpan(`${spanPrefix}.insertOrIgnore`)),
		upsert: (input: unknown, settings: { readonly updateColumns: readonly string[] }) =>
			Effect.gen(function* () {
				const rows = yield* yield* statement(input, settings.updateColumns);
				return yield* decode(rows[0]);
			}).pipe(Effect.withSpan(`${spanPrefix}.upsert`)),
	};
}
