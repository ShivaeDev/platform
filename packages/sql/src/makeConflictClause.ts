import { Array as Arr, Effect, Schema, SchemaAST, SchemaIssue } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import { makeFilter } from "#repositoryFilter.ts";
import type { UpsertAssignment } from "#upsertColumns.ts";

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
	function assignment(entry: UpsertAssignment) {
		const column = typeof entry === "string" ? entry : entry.column;
		const incoming = sql`excluded.${sql(column)}`;
		const stored = sql`${sql(options.tableName)}.${sql(column)}`;
		let value = incoming;
		if (typeof entry !== "string") {
			value = entry.mode === "add" ? sql`${stored} + ${incoming}` : sql`coalesce(${incoming}, ${stored})`;
		}
		return sql`${sql(column)} = ${value}`;
	}
	function encodePredicate([key, value]: readonly [string, unknown]) {
		return Effect.gen(function* () {
			const field = yield* filter.fieldAt(key);
			const encoded = yield* Schema.encodeEffect(field)(value);
			return { encoded, key, nullish: value === null || encoded === null };
		});
	}
	function postgresPredicate(input: Readonly<Record<string, unknown>>) {
		return Effect.gen(function* () {
			const entries = yield* Effect.forEach(
				Object.entries(input).filter(([, value]) => value !== undefined),
				encodePredicate,
			);
			if (entries.length === 0) {
				return sql.and([]);
			}
			// PostgreSQL must see constants to infer a partial index under generic plans.
			const [quoted] = yield* sql`select ${sql.csv(entries.map(({ encoded }) => sql`quote_nullable(${encoded}::text)`))}`.values;
			const literals = yield* Schema.decodeUnknownEffect(Schema.Array(Schema.String))(quoted);
			return sql.and(
				Arr.zip(entries, literals).map(([{ key, nullish }, literal]) =>
					nullish ? sql`${sql(key)} is null` : sql`${sql(key)} = ${sql.literal(literal)}`,
				),
			);
		});
	}
	function conflictPredicate(input: Readonly<Record<string, unknown>>) {
		return sql.onDialectOrElse({ orElse: () => filter.where(input), pg: () => postgresPredicate(input) });
	}
	function clause(
		encoded: Readonly<Record<string, unknown>>,
		updateColumns?: readonly UpsertAssignment[],
		updateWhere?: Readonly<Record<string, unknown>>,
	) {
		return Effect.gen(function* () {
			yield* validateColumns(encoded, conflictColumns);
			if (updateColumns !== undefined) {
				yield* validateColumns(
					encoded,
					updateColumns.map((entry) => (typeof entry === "string" ? entry : entry.column)),
					[...idColumns, ...conflictColumns, ...immutable],
				);
			}
			const conflict = sql.csv(conflictColumns.map((column) => sql`${sql(column)}`));
			const where = options.conflictWhere === undefined ? sql`` : sql`where ${yield* conflictPredicate(options.conflictWhere)}`;
			const action = updateColumns === undefined ? sql`do nothing` : sql`do update set ${sql.csv(updateColumns.map(assignment))}`;
			const condition = updateWhere === undefined ? sql`` : sql`where ${yield* updateFilter.where(updateWhere, true, true)}`;
			return sql`on conflict (${conflict}) ${where} ${action} ${condition}`;
		});
	}
	return clause;
}
