import * as PgClient from "@effect/sql-pg/PgClient";
import { Data, Effect, Option } from "effect";
import type { Model } from "effect/schema";
import type { PostgresColumn } from "./migrationUpgrade.ts";

export class ModelColumnMismatch extends Data.TaggedError("ModelColumnMismatch")<{
	readonly problems: readonly string[];
}> {}

export const assertModelColumns = Effect.fn("PostgresTest.assertModelColumns")(function* <TModel extends Model.Any>(
	columns: readonly PostgresColumn[],
	model: TModel,
	types: { readonly [TField in keyof NoInfer<TModel>["fields"]]: string },
) {
	const client = yield* Effect.serviceOption(PgClient.PgClient);
	const config = Option.getOrUndefined(client)?.config;
	const queryFields = new Map(Object.keys(model.fields).map((name) => [config?.transformQueryNames?.(name) ?? name, name]));
	function fieldName(name: string) {
		return queryFields.get(name) ?? config?.transformResultNames?.(name) ?? name;
	}
	const expectedTypes: Readonly<Record<string, string>> = types;
	function columnKey(name: string) {
		return config?.transformQueryNames === undefined ? fieldName(name) : name;
	}
	const actual = new Map(columns.map(({ name, type }) => [columnKey(name), type]));
	const problems: string[] = [];
	for (const name of Object.keys(model.fields)) {
		const type = actual.get(config?.transformQueryNames?.(name) ?? name);
		if (type === undefined) {
			problems.push(`Missing column: ${name}`);
		} else if (type !== expectedTypes[name]) {
			problems.push(`Wrong type for ${name}: expected ${expectedTypes[name]}, received ${type}`);
		}
		if (!Object.hasOwn(expectedTypes, name)) {
			problems.push(`Missing expected PostgreSQL type: ${name}`);
		}
	}
	for (const column of columns) {
		const name = fieldName(column.name);
		if (!queryFields.has(columnKey(column.name))) {
			problems.push(`Extra column: ${name}`);
		}
	}
	for (const name of Object.keys(expectedTypes)) {
		if (!Object.hasOwn(model.fields, name)) {
			problems.push(`Extra expected PostgreSQL type: ${name}`);
		}
	}
	return yield* problems.length === 0 ? Effect.void : Effect.fail(new ModelColumnMismatch({ problems }));
});
