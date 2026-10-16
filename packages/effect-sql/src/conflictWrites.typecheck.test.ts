import { Context, Effect, type Option, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import type { SqlError } from "effect/sql/SqlError";
import { expectTypeOf, it } from "vitest";
import { makeRepository } from "#repository.ts";

class Prefix extends Context.Service<Prefix, string>()("ingest/Prefix") {}
const Source = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transformEffect((value: string) => Effect.map(Prefix, (prefix) => value.slice(prefix.length))),
		encode: SchemaGetter.transformEffect((value: string) => Effect.map(Prefix, (prefix) => prefix + value)),
	}),
);
class Reading extends Model.Class<Reading>("Reading")({
	amount: Schema.NumberFromString,
	createdAt: Model.Field({ json: Schema.DateFromString, select: Schema.Date }),
	origin: Model.Field({ insert: Schema.String, select: Schema.String }),
	sequence: Schema.NumberFromString,
	source: Source,
}) {}

const program = Effect.gen(function* () {
	const options = { idColumn: ["source", "sequence"], spanPrefix: "Reading", tableName: "readings" } as const;
	const readings = yield* makeRepository(Reading, { ...options, conflictColumns: ["source", "sequence"] });
	const input = { amount: 52, origin: "import", sequence: 1, source: "meter" };
	readings.findById({ sequence: 1, source: "meter" });
	readings.delete({ sequence: 1, source: "meter" });
	readings.upsert(input, { updateColumns: ["amount"] });
	expectTypeOf<Effect.Success<ReturnType<typeof readings.insertOrIgnore>>>().toEqualTypeOf<Option.Option<Reading>>();
	expectTypeOf<Effect.Success<ReturnType<typeof readings.upsert>>>().toEqualTypeOf<Reading>();
	expectTypeOf<Effect.Error<ReturnType<typeof readings.upsert>>>().toEqualTypeOf<SqlError | Schema.SchemaError>();
	expectTypeOf<Effect.Services<ReturnType<typeof readings.insertOrIgnore>>>().toEqualTypeOf<Prefix>();
	expectTypeOf<Effect.Services<ReturnType<typeof readings.upsert>>>().toEqualTypeOf<Prefix>();
	expectTypeOf<Effect.Services<ReturnType<typeof readings.findById>>>().toEqualTypeOf<Prefix>();
	expectTypeOf<Effect.Services<ReturnType<typeof readings.delete>>>().toEqualTypeOf<Prefix>();
	// @ts-expect-error Composite IDs require the full key.
	readings.findById({ source: "meter" });
	// @ts-expect-error Composite IDs are objects.
	readings.delete("meter");
	// @ts-expect-error Key codecs take their decoded type.
	readings.findById({ sequence: "1", source: "meter" });
	// @ts-expect-error Writes use the model's insert schema.
	readings.insertOrIgnore({ ...input, amount: "52" });
	// @ts-expect-error Upserts use the model's insert schema.
	readings.upsert({ ...input, amount: "52" }, { updateColumns: ["amount"] });
	// @ts-expect-error Conflict columns cannot be updated.
	readings.upsert(input, { updateColumns: ["source"] });
	// @ts-expect-error Generated fields cannot be updated.
	readings.upsert(input, { updateColumns: ["createdAt"] });
	// @ts-expect-error Insert-only fields cannot be updated.
	readings.upsert(input, { updateColumns: ["origin"] });
	// @ts-expect-error Unknown update columns are rejected.
	readings.upsert(input, { updateColumns: ["missing"] });
	// @ts-expect-error Update columns cannot be empty.
	readings.upsert(input, { updateColumns: [] });
	// @ts-expect-error Conflict columns must be inserted model fields.
	makeRepository(Reading, { ...options, conflictColumns: ["createdAt"] });
	// @ts-expect-error Conflict columns cannot be empty.
	makeRepository(Reading, { ...options, conflictColumns: [] });
	// @ts-expect-error Primary keys must name model fields.
	makeRepository(Reading, { ...options, idColumn: ["source", "missing"] });
	const plain = yield* makeRepository(Reading, options);
	// @ts-expect-error Idempotent writes require declared conflict columns.
	plain.insertOrIgnore(input);
});

it("idempotent composite repository type contracts compile", () => {
	expectTypeOf(program).toBeObject();
});
