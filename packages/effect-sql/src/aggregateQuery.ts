import type { BigDecimal, Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import type { SqlError } from "effect/sql/SqlError";
import type { FindManyFilter, OrderedValue } from "#repositoryFilter.ts";

type Row<T extends Model.Any> = Schema.Struct.Type<T["fields"]>;
type Key<T extends Model.Any> = Extract<keyof T["fields"] & keyof Row<T>, string>;
type FieldsOfType<T extends Model.Any, TValue> = {
	[TKey in Key<T>]: [NonNullable<Row<T>[TKey]>] extends [TValue] ? TKey : never;
}[Key<T>];
interface Operands<T extends Model.Any> {
	avg: FieldsOfType<T, number | BigDecimal.BigDecimal>;
	boolAnd: FieldsOfType<T, boolean>;
	boolOr: FieldsOfType<T, boolean>;
	count: "*" | Key<T>;
	max: FieldsOfType<T, OrderedValue>;
	min: FieldsOfType<T, OrderedValue>;
	sum: FieldsOfType<T, number | BigDecimal.BigDecimal>;
}
export type AggregateExpression<T extends Model.Any> = {
	[TOperation in keyof Operands<T>]: { readonly [TKey in TOperation]: Operands<T>[TKey] } & {
		readonly [TKey in Exclude<keyof Operands<T>, TOperation>]?: never;
	};
}[keyof Operands<T>];

type AggregateValue<T extends Model.Any, TExpression> = TExpression extends { readonly count: unknown }
	? number
	: TExpression extends { readonly boolOr: unknown } | { readonly boolAnd: unknown }
		? boolean | null
		: TExpression extends { readonly [TKey in infer TOperation]: infer TField }
			? TOperation extends "sum" | "avg" | "min" | "max"
				? TField extends Key<T>
					? Row<T>[TField] | null
					: never
				: never
			: never;

export interface AggregateQuery<T extends Model.Any, TGroup extends readonly Key<T>[], TAggregates> {
	readonly aggregates: TAggregates & { readonly [TKey in TGroup[number]]?: never };
	readonly groupBy: TGroup;
	readonly limit?: number;
	readonly orderBy?: readonly { readonly field: TGroup[number] | Extract<keyof TAggregates, string>; readonly direction: "asc" | "desc" }[];
	readonly where?: FindManyFilter<T>;
}

export type Aggregate<T extends Model.Any> = <
	const TGroup extends readonly [Key<T>, ...Key<T>[]],
	const TAggregates extends Readonly<Record<string, AggregateExpression<T>>>,
>(
	query: AggregateQuery<T, TGroup, TAggregates>,
) => Effect.Effect<
	Array<{
		readonly [TName in TGroup[number] | keyof TAggregates]: TName extends TGroup[number] ? Row<T>[TName] : AggregateValue<T, TAggregates[TName]>;
	}>,
	SqlError | Schema.SchemaError,
	T["fields"][Key<T>]["EncodingServices"] | T["fields"][Key<T>]["DecodingServices"]
>;
