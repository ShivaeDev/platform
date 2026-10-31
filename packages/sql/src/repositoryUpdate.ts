import type { Brand, Cause } from "effect";
import { Effect, Schema, SchemaAST, SchemaIssue } from "effect";
import type { Model } from "effect/schema";
import type { SqlError } from "effect/sql/SqlError";

type WithoutOverride<A> = A extends infer TValue & Brand.Brand<"Override"> ? TValue : A;
export type UpdateInput<TModel extends Model.Any> = {
	readonly [TKey in keyof TModel["update"]["Type"]]: WithoutOverride<TModel["update"]["Type"][TKey]>;
};

type Column<TModel extends Model.Any, TId extends PropertyKey> = Exclude<Extract<keyof UpdateInput<TModel>, string>, TId>;
type Selected<TModel extends Model.Any, TId extends PropertyKey, TColumn extends PropertyKey> = Required<
	Pick<UpdateInput<TModel>, Extract<TId | TColumn, keyof UpdateInput<TModel>>>
>;
interface Columns<TColumn> {
	readonly columns: readonly [TColumn, ...TColumn[]];
}
type WriteResult<TModel extends Model.Any, A, E = never> = Effect.Effect<
	A,
	SqlError | Schema.SchemaError | E,
	TModel["update"]["EncodingServices"] | TModel["DecodingServices"]
>;

export interface Update<TModel extends Model.Any, TId extends PropertyKey> {
	<TColumn extends Column<TModel, TId>>(
		input: Selected<TModel, TId, TColumn>,
		options: Columns<TColumn> & { readonly onMissing: "fail" },
	): WriteResult<TModel, TModel["Type"], Cause.NoSuchElementError>;
	<TColumn extends Column<TModel, TId>>(input: Selected<TModel, TId, TColumn>, options: Columns<TColumn>): WriteResult<TModel, TModel["Type"]>;
	(input: UpdateInput<TModel>, options: { readonly onMissing: "fail" }): WriteResult<TModel, TModel["Type"], Cause.NoSuchElementError>;
	(input: UpdateInput<TModel>): WriteResult<TModel, TModel["Type"]>;
}

export interface UpdateVoid<TModel extends Model.Any, TId extends PropertyKey> {
	<TColumn extends Column<TModel, TId>>(
		input: Selected<TModel, TId, TColumn>,
		options: Columns<TColumn>,
	): Effect.Effect<void, SqlError | Schema.SchemaError, TModel["update"]["EncodingServices"]>;
	(input: UpdateInput<TModel>): Effect.Effect<void, SqlError | Schema.SchemaError, TModel["update"]["EncodingServices"]>;
}

export const selectedUpdate = Effect.fnUntraced(function* (
	model: Model.Any,
	columns: readonly string[],
	idColumns: readonly string[],
	input: Readonly<Record<string, unknown>>,
) {
	const ast = model.update.ast;
	const fields = SchemaAST.isObjects(ast) ? ast.propertySignatures : [];
	const writable = new Set(fields.map((field) => String(field.name)));
	const invalid = columns.find((column) => idColumns.includes(column) || !writable.has(column));
	if (columns.length === 0 || invalid !== undefined) {
		return yield* Effect.fail(new Schema.SchemaError(new SchemaIssue.Pointer([invalid ?? ""], new SchemaIssue.UnexpectedKey(ast, invalid ?? ""))));
	}
	const missing = [...idColumns, ...columns].find((column) => !Object.hasOwn(input, column));
	if (missing !== undefined) {
		return yield* Effect.fail(new Schema.SchemaError(new SchemaIssue.Pointer([missing], new SchemaIssue.MissingKey(undefined))));
	}
	return Schema.make(
		new SchemaAST.Objects(
			fields.filter((field) => [...idColumns, ...columns].includes(String(field.name))),
			[],
		),
	);
});
