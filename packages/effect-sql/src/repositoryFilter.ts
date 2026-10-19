import { Effect, Schema, SchemaIssue } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";

export type RepositoryFilter<TModel extends Model.Any> = {
	readonly [TField in keyof Schema.Struct.Type<TModel["fields"]>]?: Schema.Struct.Type<TModel["fields"]>[TField] | undefined;
};

export type FindManyFilter<TModel extends Model.Any> = {
	readonly [TField in keyof Schema.Struct.Type<TModel["fields"]>]?:
		| Schema.Struct.Type<TModel["fields"]>[TField]
		| { readonly in: readonly Schema.Struct.Type<TModel["fields"]>[TField][] }
		| undefined;
};

export function makeFilter<TModel extends Model.Any>(model: TModel, sql: SqlClient.SqlClient) {
	function fieldAt(key: string) {
		const field = Object.hasOwn(model.fields, key) ? model.fields[key] : undefined;
		return field === undefined
			? Effect.fail(new Schema.SchemaError(new SchemaIssue.Pointer([key], new SchemaIssue.UnexpectedKey(model.ast, key))))
			: Effect.succeed(field);
	}
	function predicate(key: string, value: unknown, allowIn: boolean) {
		return Effect.flatMap(fieldAt(key), (field) => {
			const encode = Schema.encodeEffect(field);
			return allowIn && typeof value === "object" && value !== null && "in" in value && Array.isArray(value.in)
				? Effect.map(
						Effect.forEach(value.in, (entry) => encode(entry)),
						(encoded) => sql.in(key, encoded),
					)
				: Effect.map(encode(value), (encoded) => (encoded === null ? sql`${sql(key)} is null` : sql`${sql(key)} = ${encoded}`));
		});
	}
	function where(input: Readonly<Record<string, unknown>> = {}, allowIn = false) {
		return Effect.map(
			Effect.forEach(
				Object.entries(input).filter(([, value]) => value !== undefined),
				([key, value]) => predicate(key, value, allowIn),
			),
			(predicates) => sql.and(predicates),
		);
	}
	return { fieldAt, where };
}
