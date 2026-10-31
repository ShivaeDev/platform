import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { tupleUnnest } from "#tupleUnnest.ts";

export type TupleColumnType =
	| "bool"
	| "bpchar"
	| "bytea"
	| "cidr"
	| "date"
	| "float4"
	| "float8"
	| "inet"
	| "int2"
	| "int4"
	| "int8"
	| "interval"
	| "jsonb"
	| "name"
	| "numeric"
	| "oid"
	| "regclass"
	| "text"
	| "time"
	| "timestamp"
	| "timestamptz"
	| "timetz"
	| "uuid"
	| "varchar";

export const tupleFilter = Symbol("sql/tupleIn");
type Row<TModel extends Model.Any> = Schema.Struct.Type<TModel["fields"]>;
type Key<TModel extends Model.Any> = Extract<keyof Row<TModel>, string>;

export interface TupleFilter<TModel extends Model.Any> {
	readonly [tupleFilter]: {
		readonly model: TModel;
		readonly fields: readonly Key<TModel>[];
		readonly values: readonly (readonly unknown[])[];
		readonly types: readonly TupleColumnType[];
	};
}

export function tupleIn<TModel extends Model.Any, const TFields extends readonly [Key<TModel>, Key<TModel>, ...Key<TModel>[]]>(
	model: TModel,
	fields: TFields,
	values: readonly { readonly [TIndex in keyof TFields]: Row<TModel>[TFields[TIndex]] }[],
	types: Readonly<Record<TFields[number], TupleColumnType>>,
): TupleFilter<TModel> {
	return { [tupleFilter]: { fields, model, types: fields.map((field: TFields[number]) => types[field]), values } };
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
		const rows: readonly (readonly unknown[])[] = yield* Effect.forEach(tuple.values, (value) => encode(value));
		if (rows.length === 0) {
			return sql`1 = 0`;
		}
		if (sql.onDialectOrElse({ orElse: () => false, pg: () => true })) {
			const relation = yield* tupleUnnest(tuple.types, rows).pipe(Effect.provideService(SqlClient.SqlClient, sql));
			return sql`(${columns}) in (select * from ${relation})`;
		}
		return sql.or(rows.map((row) => sql`(${columns}) = (${sql.csv(row.map((entry) => sql`${entry}`))})`));
	});
}
