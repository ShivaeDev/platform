import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import type { RepositoryListFilter } from "#repositoryFilter.ts";
import { makeFilter } from "#repositoryFilter.ts";
import { tupleFilter } from "#tupleIn.ts";

export function pinnedGroups(
	model: Model.Any,
	sql: SqlClient.SqlClient,
	partitionBy: readonly string[],
	input: RepositoryListFilter<Model.Any> = {},
) {
	const tuple = input[tupleFilter];
	if (
		tuple?.values.length === 0
		|| Object.values(input).some(
			(value) => typeof value === "object" && value !== null && "in" in value && Array.isArray(value.in) && value.in.length === 0,
		)
	) {
		return Effect.succeed({ groups: [], remaining: input });
	}
	const exactTuple = tuple !== undefined && tuple.fields.length === partitionBy.length && partitionBy.every((key) => tuple.fields.includes(key));
	let groups: readonly (readonly unknown[])[] = [[]];
	const remaining = { ...input };
	if (exactTuple) {
		groups = tuple.values.map((values) => partitionBy.map((key) => values[tuple.fields.indexOf(key)]));
		delete remaining[tupleFilter];
	} else {
		for (const key of partitionBy) {
			const value = input[key];
			if (value === undefined) {
				return Effect.succeed(undefined);
			}
			const values = typeof value === "object" && value !== null && "in" in value && Array.isArray(value.in) ? value.in : [value];
			groups = groups.flatMap((group) => values.map((entry) => [...group, entry]));
			delete remaining[key];
		}
	}
	const { fieldAt } = makeFilter(model, sql);
	return Effect.gen(function* () {
		const fields = yield* Effect.forEach(partitionBy, fieldAt);
		const groupsEncoded = yield* Effect.forEach(groups, (group) => Schema.encodeUnknownEffect(Schema.Tuple(fields))(group));
		return { groups: groupsEncoded, remaining };
	});
}
