import { type BigDecimal, Context, Effect, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import type { SqlError } from "effect/sql/SqlError";
import { expectTypeOf, it } from "vitest";
import { makeRepository } from "#repository.ts";

class Codec extends Context.Service<Codec, string>()("AggregateCodec") {}
const Name = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transformEffect((value: string) => Effect.map(Codec, (prefix) => value.slice(prefix.length))),
		encode: SchemaGetter.transformEffect((value: string) => Effect.map(Codec, (prefix) => prefix + value)),
	}),
);
class Row extends Model.Class<Row>("AggregateRow")({
	amount: Schema.NullOr(Schema.BigDecimalFromString),
	duration: Schema.Int,
	failed: Schema.Boolean,
	id: Schema.Int,
	name: Name,
	tags: Schema.Array(Schema.String),
}) {}

const program = Effect.gen(function* () {
	const rows = yield* makeRepository(Row, { idColumn: "id", spanPrefix: "Row", tableName: "rows" });
	const result = rows.aggregate({
		aggregates: {
			average: { avg: "amount" },
			failed: { boolOr: "failed" },
			first: { min: "name" },
			tests: { count: "*" },
			total: { sum: "duration" },
		},
		groupBy: ["name"],
		orderBy: [{ direction: "desc", field: "total" }],
		where: { duration: { gt: 1 } },
	});
	expectTypeOf<Effect.Success<typeof result>[number]>().toEqualTypeOf<{
		readonly name: string;
		readonly total: number | null;
		readonly average: BigDecimal.BigDecimal | null;
		readonly tests: number;
		readonly failed: boolean | null;
		readonly first: string | null;
	}>();
	expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<SqlError | Schema.SchemaError>();
	expectTypeOf<Effect.Services<typeof result>>().toEqualTypeOf<Codec>();
	// @ts-expect-error Aggregate operands must name model fields.
	rows.aggregate({ aggregates: { total: { sum: "duraton" } }, groupBy: ["name"] });
	// @ts-expect-error Group fields must name model fields.
	rows.aggregate({ aggregates: { tests: { count: "*" } }, groupBy: ["missing"] });
	// @ts-expect-error Text cannot be summed.
	rows.aggregate({ aggregates: { total: { sum: "name" } }, groupBy: ["name"] });
	// @ts-expect-error Text cannot be averaged.
	rows.aggregate({ aggregates: { total: { avg: "name" } }, groupBy: ["name"] });
	// @ts-expect-error An aggregate cannot repeat a group field.
	rows.aggregate({ aggregates: { name: { count: "*" } }, groupBy: ["name"] });
	// @ts-expect-error A group must be nonempty.
	rows.aggregate({ aggregates: { tests: { count: "*" } }, groupBy: [] });
	// @ts-expect-error Boolean aggregates require boolean fields.
	rows.aggregate({ aggregates: { failed: { boolAnd: "duration" } }, groupBy: ["name"] });
	// @ts-expect-error Min and max require ordered fields.
	rows.aggregate({ aggregates: { first: { max: "tags" } }, groupBy: ["name"] });
	// @ts-expect-error Sort keys must be selected groups or aggregate names.
	rows.aggregate({ aggregates: { tests: { count: "*" } }, groupBy: ["name"], orderBy: [{ direction: "asc", field: "duration" }] });
	// @ts-expect-error Each result names exactly one aggregate.
	rows.aggregate({ aggregates: { tests: { count: "*", sum: "duration" } }, groupBy: ["name"] });
});

it("aggregates retain the chosen result types and codec services", () => {
	expectTypeOf(program).toBeObject();
});
