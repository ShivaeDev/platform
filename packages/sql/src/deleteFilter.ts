import { Effect, Schema, SchemaIssue } from "effect";
import type { Model } from "effect/schema";
import { type AllRows, everyRow } from "#allRows.ts";
import type { FindManyFilter } from "#repositoryFilter.ts";
import { type TupleFilter, tupleFilter } from "#tupleIn.ts";

type Restricting<TFilter> = {
	readonly [TKey in keyof TFilter]-?: TFilter & { readonly [TEntry in TKey]-?: Exclude<TFilter[TKey], undefined> };
}[keyof TFilter];

export type DeleteFilter<TModel extends Model.Any> = Restricting<FindManyFilter<TModel>> | AllRows;

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
