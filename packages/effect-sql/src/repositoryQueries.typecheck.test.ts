import { Context, Effect, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import type { SqlError } from "effect/sql/SqlError";
import { expectTypeOf, it } from "vitest";
import { type FindMany, makeRepository } from "#repository.ts";

class Codec extends Context.Service<Codec, string>()("WindowCodec") {}
const Name = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transformEffect((value: string) => Effect.map(Codec, (prefix) => value.slice(prefix.length))),
		encode: SchemaGetter.transformEffect((value: string) => Effect.map(Codec, (prefix) => prefix + value)),
	}),
);
class Row extends Model.Class<Row>("WindowRow")({ id: Schema.Number, name: Name, value: Schema.NumberFromString }) {}

const program = Effect.gen(function* () {
	const rows = yield* makeRepository(Row, { idColumn: "id", spanPrefix: "Row", tableName: "rows" });
	const orderBy = [
		{ direction: "desc", field: "value" },
		{ direction: "asc", field: "id" },
	] as const satisfies FindMany<typeof Row, "id">["orderBy"];
	const query = { limit: 2, orderBy, partitionBy: ["name"] } as const;
	const result = rows.latestPerGroup({ ...query, where: { name: "A", value: { in: [1, 2] } } });
	expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<Array<{ readonly id: number; readonly name: string; readonly value: number }>>();
	expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<SqlError | Schema.SchemaError>();
	expectTypeOf<Effect.Services<typeof result>>().toEqualTypeOf<Codec>();
	// @ts-expect-error Partitions must name model fields.
	rows.latestPerGroup({ ...query, partitionBy: ["missing"] });
	// @ts-expect-error Partitions must be nonempty.
	rows.latestPerGroup({ ...query, partitionBy: [] });
	// @ts-expect-error Ordering must be nonempty.
	rows.latestPerGroup({ ...query, orderBy: [] });
	// @ts-expect-error Every sort key must name a model field.
	rows.latestPerGroup({ ...query, orderBy: [{ direction: "asc", field: "missing" }] });
	// @ts-expect-error Ordering directions are asc or desc.
	rows.latestPerGroup({ ...query, orderBy: [{ direction: "ascending", field: "id" }] });
	// @ts-expect-error Filters use decoded field values.
	rows.latestPerGroup({ ...query, where: { value: "1" } });
	// @ts-expect-error The per-partition limit is required.
	rows.latestPerGroup({ orderBy, partitionBy: ["name"] });
});

it("latestPerGroup retains model types, codecs and existing ordering", () => {
	expectTypeOf(program).toBeObject();
});
