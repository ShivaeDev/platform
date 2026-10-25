import { Effect, Schema, SchemaIssue } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import { type TupleFilter, tuplePredicate } from "#tupleIn.ts";

export type RepositoryFilter<TModel extends Model.Any> = {
	readonly [TField in keyof Schema.Struct.Type<TModel["fields"]>]?: Schema.Struct.Type<TModel["fields"]>[TField] | undefined;
};

export type RepositoryListFilter<TModel extends Model.Any> = Partial<TupleFilter<TModel>> & {
	readonly [TField in keyof Schema.Struct.Type<TModel["fields"]>]?:
		| Schema.Struct.Type<TModel["fields"]>[TField]
		| { readonly in: readonly Schema.Struct.Type<TModel["fields"]>[TField][] }
		| undefined;
};

const Ordered = Schema.Union([Schema.String, Schema.Number, Schema.BigInt, Schema.Date, Schema.BigDecimal, Schema.DateTimeUtc]);
type OrderedValue = typeof Ordered.Type;
export type Comparisons<T, TOperand = NonNullable<T>> = [NonNullable<T>] extends [OrderedValue]
	? { readonly gt?: TOperand; readonly gte?: TOperand; readonly lt?: TOperand; readonly lte?: TOperand }
	: { readonly gt?: never; readonly gte?: never; readonly lt?: never; readonly lte?: never };
type Pattern<T> = [NonNullable<T>] extends [string] ? { readonly like?: NonNullable<T> } : { readonly like?: never };

export type FindManyFilter<TModel extends Model.Any> = Partial<TupleFilter<TModel>> & {
	readonly [TField in keyof Schema.Struct.Type<TModel["fields"]>]?:
		| Schema.Struct.Type<TModel["fields"]>[TField]
		| (Comparisons<Schema.Struct.Type<TModel["fields"]>[TField]> & Pattern<Schema.Struct.Type<TModel["fields"]>[TField]>)
		| { readonly in: readonly Schema.Struct.Type<TModel["fields"]>[TField][] }
		| undefined;
};

const operators = { gt: ">", gte: ">=", like: "like", lt: "<", lte: "<=" } as const;
function isOperator(key: string): key is keyof typeof operators {
	return Object.hasOwn(operators, key);
}

export function makeFilter<TModel extends Model.Any>(model: TModel, sql: SqlClient.SqlClient, references?: { readonly tableName: string }) {
	function fieldAt(key: string) {
		const field = Object.hasOwn(model.fields, key) ? model.fields[key] : undefined;
		return field === undefined
			? Effect.fail(new Schema.SchemaError(new SchemaIssue.Pointer([key], new SchemaIssue.UnexpectedKey(model.ast, key))))
			: Effect.succeed(field);
	}
	function column(key: string) {
		return references === undefined ? sql`${sql(key)}` : sql`${sql(references.tableName)}.${sql(key)}`;
	}
	function reference(value: unknown) {
		return references !== undefined && typeof value === "object" && value !== null && "excluded" in value && typeof value.excluded === "string"
			? value.excluded
			: undefined;
	}
	function comparison(key: string, field: Schema.Constraint, operator: string, operand: unknown) {
		if (!isOperator(operator)) {
			return Effect.fail(new Schema.SchemaError(new SchemaIssue.Pointer([key, operator], new SchemaIssue.UnexpectedKey(model.ast, operator))));
		}
		const incoming = reference(operand);
		if (incoming !== undefined) {
			return Effect.as(fieldAt(incoming), sql`${column(key)} ${sql.literal(operators[operator])} excluded.${sql(incoming)}`);
		}
		const validate = Schema.decodeUnknownEffect(operator === "like" ? Schema.String : Ordered);
		return Effect.flatMap(validate(operand), (decoded) =>
			Effect.map(Schema.encodeEffect(field)(decoded), (encoded) => sql`${column(key)} ${sql.literal(operators[operator])} ${encoded}`),
		);
	}
	function inPredicate(key: string, encoded: readonly unknown[]) {
		if (references === undefined) {
			return sql.in(key, encoded);
		}
		return encoded.length === 0 ? sql`1 = 0` : sql`${column(key)} in ${sql.in(encoded)}`;
	}
	function predicate(key: string, value: unknown, allowIn: boolean, allowComparisons: boolean) {
		return Effect.flatMap(fieldAt(key), (field) => {
			const incoming = reference(value);
			if (incoming !== undefined) {
				return Effect.as(fieldAt(incoming), sql`${column(key)} = excluded.${sql(incoming)}`);
			}
			const encode = Schema.encodeEffect(field);
			if (allowComparisons && typeof value === "object" && value !== null && Object.keys(value).some(isOperator)) {
				return Effect.map(
					Effect.forEach(Object.entries(value), ([operator, operand]) => comparison(key, field, operator, operand)),
					(predicates) => sql.and(predicates),
				);
			}
			return allowIn && typeof value === "object" && value !== null && "in" in value && Array.isArray(value.in)
				? Effect.map(
						Effect.forEach(value.in, (entry) => encode(entry)),
						(encoded) => inPredicate(key, encoded),
					)
				: Effect.map(encode(value), (encoded) => (encoded === null ? sql`${column(key)} is null` : sql`${column(key)} = ${encoded}`));
		});
	}
	function where(input: Readonly<Record<string, unknown>> & Partial<TupleFilter<Model.Any>> = {}, allowIn = false, allowComparisons = false) {
		return Effect.gen(function* () {
			const predicates = yield* Effect.forEach(
				Object.entries(input).filter(([, value]) => value !== undefined),
				([key, value]) => predicate(key, value, allowIn, allowComparisons),
			);
			if (allowIn) {
				const tuple = yield* tuplePredicate(input, sql, fieldAt);
				if (tuple !== undefined) {
					predicates.push(tuple);
				}
			}
			return sql.and(predicates);
		});
	}
	return { fieldAt, where };
}
