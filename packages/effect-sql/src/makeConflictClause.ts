import { Effect, Schema, SchemaAST, SchemaIssue } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import { makeFilter } from "#repositoryFilter.ts";

export function makeConflictClause(
	model: Model.Any,
	sql: SqlClient.SqlClient,
	options: {
		readonly tableName: string;
		readonly conflictColumns: readonly string[];
		readonly conflictWhere?: Readonly<Record<string, unknown>>;
		readonly idColumns: readonly string[];
	},
) {
	const { conflictColumns, idColumns } = options;
	const updateFilter = makeFilter(model, sql, options);
	const filter = makeFilter(model, sql);
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
	function clause(encoded: Readonly<Record<string, unknown>>, updateColumns?: readonly string[], updateWhere?: Readonly<Record<string, unknown>>) {
		return Effect.gen(function* () {
			yield* validateColumns(encoded, conflictColumns);
			if (updateColumns !== undefined) {
				yield* validateColumns(encoded, updateColumns, [...idColumns, ...conflictColumns, ...immutable]);
			}
			const conflict = sql.csv(conflictColumns.map((column) => sql`${sql(column)}`));
			const where = options.conflictWhere === undefined ? sql`` : sql`where ${yield* filter.where(options.conflictWhere)}`;
			const action =
				updateColumns === undefined
					? sql`do nothing`
					: sql`do update set ${sql.csv(updateColumns.map((column) => sql`${sql(column)} = excluded.${sql(column)}`))}`;
			const condition = updateWhere === undefined ? sql`` : sql`where ${yield* updateFilter.where(updateWhere, true, true)}`;
			return sql`on conflict (${conflict}) ${where} ${action} ${condition}`;
		});
	}
	return clause;
}
