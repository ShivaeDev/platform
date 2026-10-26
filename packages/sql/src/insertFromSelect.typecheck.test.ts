import { Context, Effect, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import { expectTypeOf, it } from "vitest";
import { makeRepository } from "#repository.ts";

class FilterPrefix extends Context.Service<FilterPrefix, string>()("select/FilterPrefix") {}
class DecodePrefix extends Context.Service<DecodePrefix, string>()("select/DecodePrefix") {}
const FilteredName = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transform((value: string) => value),
		encode: SchemaGetter.transformEffect((value: string) => Effect.map(FilterPrefix, (prefix) => prefix + value)),
	}),
);
const DecodedName = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transformEffect((value: string) => Effect.map(DecodePrefix, (prefix) => prefix + value)),
		encode: SchemaGetter.transform((value: string) => value),
	}),
);
class Source extends Model.Class<Source>("SelectSource")({
	amount: Schema.NumberFromString,
	count: Schema.Number,
	id: Schema.Int,
	label: FilteredName,
}) {}
class Target extends Model.Class<Target>("SelectTarget")({
	amount: Schema.NumberFromString,
	id: Model.Field({ select: Schema.Int, update: Schema.Int }),
	key: Schema.Int,
	name: Model.Field({ insert: Schema.String, select: DecodedName, update: Schema.String }),
	note: Schema.optional(Schema.String),
}) {}
const program = Effect.gen(function* () {
	const source = yield* makeRepository(Source, { idColumn: "id", spanPrefix: "Source", tableName: "source" });
	const target = yield* makeRepository(Target, {
		conflictColumns: ["key"],
		conflictWhere: { name: "copy" },
		idColumn: "id",
		spanPrefix: "Target",
		tableName: "target",
	});
	const selected = source.select({ select: ["id", "label", "amount"], where: { label: "flaky" } });
	const mapping = { amount: "amount", key: "id", name: "label" } as const;
	const inserted = target.insertFromSelect(selected, mapping);
	expectTypeOf<Effect.Success<typeof inserted>>().toEqualTypeOf<Target[]>();
	expectTypeOf<Effect.Services<typeof inserted>>().toEqualTypeOf<FilterPrefix | DecodePrefix>();
	const ignored = target.insertFromSelectOrIgnore(selected, mapping);
	expectTypeOf<Effect.Services<typeof ignored>>().toEqualTypeOf<FilterPrefix | DecodePrefix>();
	target.insertFromSelect(selected, { ...mapping, note: "label" });
	// @ts-expect-error A string source cannot supply the numeric target key.
	target.insertFromSelect(selected, { ...mapping, key: "label" });
	// @ts-expect-error Matching decoded types cannot bridge different storage representations.
	target.insertFromSelect(source.select(), { ...mapping, amount: "count" });
	// @ts-expect-error Source names must be present in the projection.
	target.insertFromSelect(source.select({ select: ["id", "amount"] }), mapping);
	// @ts-expect-error Unknown target columns are rejected.
	target.insertFromSelect(selected, { ...mapping, missing: "label" });
	// @ts-expect-error Every required insert field needs a mapping.
	target.insertFromSelect(selected, { key: "id", name: "label" });
	// @ts-expect-error Database-generated target columns are not insertable.
	target.insertFromSelect(selected, { ...mapping, id: "id" });
	// @ts-expect-error Ignore-on-conflict retains the same column compatibility checks.
	target.insertFromSelectOrIgnore(selected, { ...mapping, key: "label" });
	// @ts-expect-error Projections use model field names.
	source.select({ select: ["missing"] });
});

it("insert-from-select checks mapped names, decoded and encoded types, and required services", () => {
	expectTypeOf(program).toBeObject();
});
