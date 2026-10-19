import { Context, Effect, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import { expectTypeOf, it } from "vitest";
import { makeRepository } from "#repository.ts";

class FilterEncoding extends Context.Service<FilterEncoding, string>()("FilterEncoding") {}
const Kind = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transform((value: string) => value),
		encode: SchemaGetter.transformEffect((value: string) => Effect.map(FilterEncoding, (prefix) => prefix + value)),
	}),
);
class Row extends Model.Class<Row>("FilteredRow")({
	id: Schema.Number,
	kind: Model.Field({ insert: Schema.String, json: Schema.String, select: Kind, update: Schema.String }),
	value: Schema.NumberFromString,
}) {}

const program = Effect.gen(function* () {
	const options = { conflictColumns: ["id"], idColumn: "id", spanPrefix: "Row", tableName: "rows" } as const;
	const plain = yield* makeRepository(Row, options);
	expectTypeOf<Effect.Services<ReturnType<typeof plain.findMany>>>().toEqualTypeOf<FilterEncoding>();
	plain.findMany({ where: { id: { in: [1, 2] }, kind: "x", value: { in: [1, 2] } } });
	// @ts-expect-error List entries use decoded field values.
	plain.findMany({ where: { value: { in: ["1"] } } });
	// @ts-expect-error List entries must name model fields.
	plain.findMany({ where: { missing: { in: [1] } } });
	expectTypeOf<Effect.Services<ReturnType<typeof plain.insertOrIgnore>>>().toEqualTypeOf<never>();
	const filtered = yield* makeRepository(Row, { ...options, conflictWhere: { kind: "x", value: 1 } });
	expectTypeOf<Effect.Services<ReturnType<typeof filtered.insertOrIgnore>>>().toEqualTypeOf<FilterEncoding>();
	expectTypeOf<Effect.Services<ReturnType<typeof filtered.insertManyOrIgnore>>>().toEqualTypeOf<FilterEncoding>();
	expectTypeOf<Effect.Services<ReturnType<typeof filtered.upsert>>>().toEqualTypeOf<FilterEncoding>();
	expectTypeOf<Effect.Services<ReturnType<typeof filtered.upsertMany>>>().toEqualTypeOf<FilterEncoding>();
	// @ts-expect-error Predicate columns must be model fields.
	makeRepository(Row, { ...options, conflictWhere: { knid: "x" } });
	// @ts-expect-error A valid predicate column does not permit a misspelled sibling.
	makeRepository(Row, { ...options, conflictWhere: { kind: "x", knid: "x" } });
	// @ts-expect-error Predicates use decoded field values.
	makeRepository(Row, { ...options, conflictWhere: { value: "1" } });
	// @ts-expect-error A predicate requires conflict columns.
	makeRepository(Row, { conflictWhere: { kind: "x" }, idColumn: "id", spanPrefix: "Row", tableName: "rows" });
});

it("conflict predicates retain field encoding services and check columns and values", () => {
	expectTypeOf(program).toEqualTypeOf<Effect.Effect<void, never, SqlClient.SqlClient>>();
});
