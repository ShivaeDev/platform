import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";

export const tupleFilter = Symbol("effect-sql/tupleIn");
type Row<TModel extends Model.Any> = Schema.Struct.Type<TModel["fields"]>;
type Key<TModel extends Model.Any> = Extract<keyof Row<TModel>, string>;

export interface TupleFilter<TModel extends Model.Any> {
	readonly [tupleFilter]: {
		readonly model: TModel;
		readonly fields: readonly Key<TModel>[];
		readonly values: readonly (readonly unknown[])[];
	};
}

export function tupleIn<TModel extends Model.Any, const TFields extends readonly [Key<TModel>, Key<TModel>, ...Key<TModel>[]]>(
	model: TModel,
	fields: TFields,
	values: readonly { readonly [TIndex in keyof TFields]: Row<TModel>[TFields[TIndex]] }[],
): TupleFilter<TModel> {
	return { [tupleFilter]: { fields, model, values } };
}

export function tuplePredicate(
	input: Partial<TupleFilter<Model.Any>>,
	sql: SqlClient.SqlClient,
	fieldAt: (key: string) => Effect.Effect<Schema.Constraint, Schema.SchemaError>,
) {
	const tuple = input[tupleFilter];
	if (tuple === undefined) {
		return Effect.succeed(undefined);
	}
	return Effect.gen(function* () {
		const fields = yield* Effect.forEach(tuple.fields, fieldAt);
		const encode = Schema.encodeUnknownEffect(Schema.Tuple(fields));
		const columns = sql.csv(tuple.fields.map((field) => sql`${sql(field)}`));
		// Row comparisons retain column type inference for string-encoded numerics without PostgreSQL's deeply nested row-IN rewrite.
		const rows = yield* Effect.forEach(tuple.values, (value) =>
			Effect.map(encode(value), (encoded) => sql`(${columns}) = (${sql.csv(encoded.map((entry) => sql`${entry}`))})`),
		);
		return rows.length === 0 ? sql`1 = 0` : sql.or(rows);
	});
}
