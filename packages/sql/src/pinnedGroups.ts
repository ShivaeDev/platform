import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import { type FindManyFilter, makeFilter } from "#repositoryFilter.ts";
import { tupleFilter } from "#tupleIn.ts";

// Only equality and in lists name groups; a not-null test or a range leaves the partition to the ranked read.
function pins(field: Schema.Constraint | undefined, value: unknown): readonly unknown[] | undefined {
	if (value === undefined || field === undefined) {
		return undefined;
	}
	const acceptsValue: (input: unknown) => boolean = Schema.is(field);
	if (acceptsValue(value)) {
		return [value];
	}
	return typeof value === "object" && value !== null && "in" in value && Array.isArray(value.in) ? value.in : undefined;
}

export const pinnedGroups = Effect.fnUntraced(function* (model: Model.Any, partitionBy: readonly string[], input: FindManyFilter<Model.Any> = {}) {
	const tuple = input[tupleFilter];
	if (
		tuple?.values.length === 0
		|| Object.values(input).some(
			(value) => typeof value === "object" && value !== null && "in" in value && Array.isArray(value.in) && value.in.length === 0,
		)
	) {
		return { groups: [], remaining: input, tuple: undefined };
	}
	const { fieldAt } = yield* makeFilter(model);
	const fields = yield* Effect.forEach(partitionBy, fieldAt);
	const exactTuple = tuple !== undefined && tuple.fields.length === partitionBy.length && partitionBy.every((key) => tuple.fields.includes(key));
	let groups: readonly (readonly unknown[])[] = [[]];
	const remaining = { ...input };
	if (exactTuple) {
		groups = tuple.values.map((values) => partitionBy.map((key) => values[tuple.fields.indexOf(key)]));
		delete remaining[tupleFilter];
	} else {
		for (const [index, key] of partitionBy.entries()) {
			const values = pins(fields[index], input[key]);
			if (values === undefined) {
				return undefined;
			}
			groups = groups.flatMap((group) => values.map((entry) => [...group, entry]));
			delete remaining[key];
		}
	}
	const groupsEncoded: readonly (readonly unknown[])[] = yield* Effect.forEach(groups, (group) =>
		Schema.encodeUnknownEffect(Schema.Tuple(fields))(group),
	);
	return { groups: groupsEncoded, remaining, tuple: exactTuple ? tuple : undefined };
});
