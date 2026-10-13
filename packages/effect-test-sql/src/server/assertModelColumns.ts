import { Data, Effect } from "effect";
import type { Model } from "effect/schema";
import type { PostgresColumn } from "./migrationUpgrade.ts";

export class ModelColumnMismatch extends Data.TaggedError("ModelColumnMismatch")<{
	readonly problems: readonly string[];
}> {}

export function assertModelColumns<TModel extends Model.Any>(
	columns: readonly PostgresColumn[],
	model: TModel,
	types: { readonly [TField in keyof NoInfer<TModel>["fields"]]: string },
) {
	const expectedTypes: Readonly<Record<string, string>> = types;
	const actual = new Map(columns.map(({ name, type }) => [name, type]));
	const problems: string[] = [];
	for (const name of Object.keys(model.fields)) {
		const type = actual.get(name);
		if (type === undefined) {
			problems.push(`Missing column: ${name}`);
		} else if (type !== expectedTypes[name]) {
			problems.push(`Wrong type for ${name}: expected ${expectedTypes[name]}, received ${type}`);
		}
		if (!Object.hasOwn(expectedTypes, name)) {
			problems.push(`Missing expected PostgreSQL type: ${name}`);
		}
	}
	for (const { name } of columns) {
		if (!Object.hasOwn(model.fields, name)) {
			problems.push(`Extra column: ${name}`);
		}
	}
	for (const name of Object.keys(expectedTypes)) {
		if (!Object.hasOwn(model.fields, name)) {
			problems.push(`Extra expected PostgreSQL type: ${name}`);
		}
	}
	return problems.length === 0 ? Effect.void : Effect.fail(new ModelColumnMismatch({ problems }));
}
