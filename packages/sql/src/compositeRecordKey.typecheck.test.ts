import { Context, Effect, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import { expectTypeOf, it } from "vitest";
import { compositeRecordKey } from "#compositeRecordKey.ts";

class KeyCodec extends Context.Service<KeyCodec, string>()("@shivaedev/sql/KeyCodec") {}
const Name = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transformEffect((value: string) => Effect.map(KeyCodec, (prefix) => value.slice(prefix.length))),
		encode: SchemaGetter.transformEffect((value: string) => Effect.map(KeyCodec, (prefix) => prefix + value)),
	}),
);
class Row extends Model.Class<Row>("SingleRowKeys")({ id: Schema.Number, name: Name, value: Schema.NumberFromString }) {}

it("composite record keys retain model types and codec services", () => {
	const key = compositeRecordKey(Row, { idColumn: ["name", "value"], tableName: "rows" }, { name: "A", value: 1 });
	expectTypeOf<Effect.Success<typeof key>>().toEqualTypeOf<string>();
	expectTypeOf<Effect.Error<typeof key>>().toEqualTypeOf<Schema.SchemaError>();
	expectTypeOf<Effect.Services<typeof key>>().toEqualTypeOf<KeyCodec>();
	// @ts-expect-error Every key component is required.
	compositeRecordKey(Row, { idColumn: ["name", "value"], tableName: "rows" }, { name: "A" });
	// @ts-expect-error Key components use decoded values.
	compositeRecordKey(Row, { idColumn: ["name", "value"], tableName: "rows" }, { name: "A", value: "1" });
	// @ts-expect-error Key columns name model fields.
	compositeRecordKey(Row, { idColumn: ["missing", "value"], tableName: "rows" }, { value: 1 });
});
