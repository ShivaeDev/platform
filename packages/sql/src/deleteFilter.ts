import { Effect, Schema, SchemaIssue } from "effect";
import type { Model } from "effect/schema";
import { type AllRows, everyRow } from "#allRows.ts";
import type { FindManyFilter } from "#repositoryFilter.ts";
import { type TupleFilter, tupleFilter } from "#tupleIn.ts";

type Restricting<TFilter> = {
	readonly [TKey in keyof TFilter]-?: TFilter & { readonly [TEntry in TKey]-?: Exclude<TFilter[TKey], undefined> };
}[keyof TFilter];

export type DeleteFilter<TModel extends Model.Any> = Restricting<FindManyFilter<TModel>> | AllRows;

type DefinedKey<TWhere> = { readonly [TKey in keyof TWhere]-?: undefined extends TWhere[TKey] ? never : TKey }[keyof TWhere];

interface DefinedEntryRequired {
	readonly "a delete needs one defined filter entry, or allRows": never;
}

// Checked against the inferred filter rather than a union of shapes, so a refusal names the rule instead of a union member.
export type DeleteCheck<TModel extends Model.Any, TWhere> = TWhere extends AllRows
	? unknown
	: [Exclude<keyof TWhere, keyof FindManyFilter<TModel>>] extends [never]
		? [DefinedKey<TWhere>] extends [never]
			? DefinedEntryRequired
			: unknown
		: { readonly [TKey in Exclude<keyof TWhere, keyof FindManyFilter<TModel>>]: "not a field of this model" };

// The read filter drops undefined entries, so a delete filter without a defined one would match the whole table.
export function restrictingFilter<TFilter extends Readonly<Record<string, unknown>> & Partial<TupleFilter<Model.Any>> & Partial<AllRows>>(
	input: TFilter,
): Effect.Effect<TFilter, Schema.SchemaError> {
	return input[everyRow] === true || Object.values(input).some((value) => value !== undefined) || input[tupleFilter] !== undefined
		? Effect.succeed(input)
		: Effect.fail(
				new Schema.SchemaError(
					new SchemaIssue.InvalidValue({ message: "A delete filter needs at least one defined entry; pass allRows to delete every row" }),
				),
			);
}
