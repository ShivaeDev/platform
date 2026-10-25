import { Context, DateTime, Effect, Schema, SchemaGetter } from "effect";
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
	active: Schema.Boolean,
	at: Schema.Date,
	id: Schema.Number,
	kind: Model.Field({ insert: Schema.String, json: Schema.String, select: Kind, update: Schema.String }),
	note: Schema.NullOr(Schema.String),
	utc: Schema.DateTimeUtcFromDate,
	value: Schema.NumberFromString,
	values: Schema.Array(Schema.Number),
}) {}

const program = Effect.gen(function* () {
	const options = { conflictColumns: ["id"], idColumn: "id", spanPrefix: "Row", tableName: "rows" } as const;
	const plain = yield* makeRepository(Row, options);
	expectTypeOf<Effect.Services<ReturnType<typeof plain.findMany>>>().toEqualTypeOf<FilterEncoding>();
	plain.findMany({ where: { id: { in: [1, 2] }, kind: "x", value: { in: [1, 2] } } });
	const read = plain.findMany({
		select: ["id"],
		where: { at: { gte: new Date("2026-10-25T00:00:00Z") }, kind: { like: "Run%" }, value: { gt: 1, lte: 3 } },
	});
	expectTypeOf<Effect.Services<typeof read>>().toEqualTypeOf<FilterEncoding>();
	expectTypeOf<Effect.Success<typeof read>>().toEqualTypeOf<Array<{ readonly id: number }>>();
	const select = plain.select({ where: { kind: { gt: "A", lt: "Z" }, note: { like: "%" }, utc: { gte: DateTime.makeUnsafe(0) } } });
	expectTypeOf<Effect.Services<typeof select.statement>>().toEqualTypeOf<FilterEncoding>();
	// @ts-expect-error Range operands use decoded numbers.
	plain.findMany({ where: { value: { gt: "1" } } });
	// @ts-expect-error Timestamp bounds use Date values.
	plain.select({ where: { at: { gte: "2026-10-25T00:00:00Z" } } });
	// @ts-expect-error UTC bounds use DateTime.Utc values.
	plain.findMany({ where: { utc: { lt: new Date("2026-10-25T00:00:00Z") } } });
	// @ts-expect-error Boolean fields have no range operators.
	plain.findMany({ where: { active: { gt: true } } });
	// @ts-expect-error Array fields have no range operators.
	plain.select({ where: { values: { lt: [1] } } });
	// @ts-expect-error LIKE is only available on text fields.
	plain.findMany({ where: { value: { like: "1%" } } });
	// @ts-expect-error LIKE patterns must be text.
	plain.select({ where: { kind: { like: 1 } } });
	// @ts-expect-error Null is an equality filter, not a range bound.
	plain.findMany({ where: { note: { lte: null } } });
	// @ts-expect-error Range filters name model fields.
	plain.select({ where: { missing: { gt: 1 } } });
	// @ts-expect-error Delete retains its equality and list filters.
	plain.delete({ id: { gt: 1 } });
	const deleted = plain.delete({ id: { in: [1, 2] }, kind: "x", value: { in: [1, 2] } });
	expectTypeOf<Effect.Services<typeof deleted>>().toEqualTypeOf<FilterEncoding>();
	expectTypeOf<Effect.Success<typeof deleted>>().toEqualTypeOf<void>();
	expectTypeOf<Effect.Services<ReturnType<typeof plain.delete>>>().toEqualTypeOf<FilterEncoding>();
	plain.delete(1);
	// @ts-expect-error Delete list entries use decoded field values.
	plain.delete({ value: { in: ["1"] } });
	// @ts-expect-error Delete filters must name model fields.
	plain.delete({ missing: { in: [1] } });
	plain.findMany({ orderBy: { direction: "asc", field: "id" } });
	const orderBy = [
		{ direction: "asc", field: "kind" },
		{ direction: "desc", field: "id" },
	] as const;
	const ordered = plain.findMany({ orderBy, select: ["value"] });
	expectTypeOf<Effect.Success<typeof ordered>>().toEqualTypeOf<Array<{ readonly value: number }>>();
	plain.findMany({ orderBy: [{ direction: "desc", field: "id" }] });
	// @ts-expect-error Ordering lists must be nonempty.
	plain.findMany({ orderBy: [] });
	// @ts-expect-error Single ordering objects must name model fields.
	plain.findMany({ orderBy: { direction: "asc", field: "missing" } });
	plain.findMany({
		orderBy: [
			{ direction: "asc", field: "id" },
			// @ts-expect-error Every ordering list entry must name a model field.
			{ direction: "desc", field: "missing" },
		],
	});
	// @ts-expect-error Ordering directions remain asc or desc.
	plain.findMany({ orderBy: [{ direction: "ascending", field: "id" }] });
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
