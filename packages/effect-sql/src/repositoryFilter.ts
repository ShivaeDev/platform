import { Effect, Schema, SchemaIssue } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";

export type RepositoryFilter<TModel extends Model.Any> = {
	readonly [TField in keyof Schema.Struct.Type<TModel["fields"]>]?: Schema.Struct.Type<TModel["fields"]>[TField] | undefined;
};

export function makeFilter<TModel extends Model.Any>(model: TModel, sql: SqlClient.SqlClient) {
	function fieldAt(key: string) {
		const field = Object.hasOwn(model.fields, key) ? model.fields[key] : undefined;
		return field === undefined
			? Effect.fail(new Schema.SchemaError(new SchemaIssue.Pointer([key], new SchemaIssue.UnexpectedKey(model.ast, key))))
			: Effect.succeed(field);
	}
	function where(input: Readonly<Record<string, unknown>> = {}) {
		return Effect.map(
			Effect.forEach(
				Object.entries(input).filter(([, value]) => value !== undefined),
				([key, value]) =>
					Effect.map(
						Effect.flatMap(fieldAt(key), (field) => Schema.encodeEffect(field)(value)),
						(encoded) => (encoded === null ? sql`${sql(key)} is null` : sql`${sql(key)} = ${encoded}`),
					),
			),
			(predicates) => sql.and(predicates),
		);
	}
	return { fieldAt, where };
}
