import { Context, DateTime, Effect, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import { expectTypeOf, it } from "vitest";
import { jsonb } from "#jsonb.ts";
import { makeRepository } from "#repository.ts";

class Prefix extends Context.Service<Prefix, string>()("partial/Prefix") {}
const Name = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transformEffect((value) => Effect.map(Prefix, (prefix) => value.slice(prefix.length))),
		encode: SchemaGetter.transformEffect((value) => Effect.map(Prefix, (prefix) => prefix + value)),
	}),
);
class Row extends Model.Class<Row>("Row")({
	createdAt: Model.Field({ select: Schema.DateTimeUtcFromDate }),
	details: jsonb(Schema.Struct({ name: Name })),
	id: Schema.NumberFromString,
	name: Name,
	note: Schema.optionalKey(Schema.String),
	owner: Schema.String,
	updatedAt: Model.DateTimeUpdateFromDate,
	version: Model.Field({ select: Schema.Int, update: Schema.Int }),
}) {}

const program = Effect.gen(function* () {
	const options = { idColumn: "id", spanPrefix: "Row", tableName: "rows" } as const;
	const rows = yield* makeRepository(Row, options);
	const row = yield* rows.findById(1);
	rows.update(row);
	rows.updateVoid(row);
	const partial = rows.update({ id: 1, name: "Published" }, { columns: ["name"] });
	expectTypeOf<Effect.Success<typeof partial>>().toEqualTypeOf<Row>();
	expectTypeOf<Effect.Services<typeof partial>>().toEqualTypeOf<Prefix>();
	const details = rows.update({ details: { name: "Published" }, id: 1 }, { columns: ["details"] });
	expectTypeOf<Effect.Services<typeof details>>().toEqualTypeOf<Prefix>();
	const voidResult = rows.updateVoid({ id: 1, name: "Published" }, { columns: ["name"] });
	expectTypeOf<Effect.Success<typeof voidResult>>().toEqualTypeOf<void>();
	expectTypeOf<Effect.Services<typeof voidResult>>().toEqualTypeOf<Prefix>();
	rows.update({ id: 1, updatedAt: DateTime.makeUnsafe(0) }, { columns: ["updatedAt"] });
	rows.update({ id: 1, note: "saved" }, { columns: ["note"] });
	// @ts-expect-error A selected optional field must be supplied.
	rows.update({ id: 1 }, { columns: ["note"] });
	// @ts-expect-error A full update still requires the full update shape.
	rows.update({ id: 1, name: "Published" });
	// @ts-expect-error Chosen-column writes require the id.
	rows.update({ name: "Published" }, { columns: ["name"] });
	// @ts-expect-error Selected values use the update field's decoded type.
	rows.update({ id: 1, name: 123 }, { columns: ["name"] });
	// @ts-expect-error Empty selections cannot form an update.
	rows.update(row, { columns: [] });
	// @ts-expect-error IDs cannot be assigned.
	rows.update(row, { columns: ["id"] });
	// @ts-expect-error Generated read-only fields cannot be assigned.
	rows.update(row, { columns: ["createdAt"] });
	// @ts-expect-error Unknown fields cannot be assigned.
	rows.update(row, { columns: ["missing"] });
	// @ts-expect-error Void writes require the selected value.
	rows.updateVoid({ id: 1 }, { columns: ["name"] });
	const owned = yield* makeRepository(Row, { ...options, idColumn: ["id", "owner"] });
	owned.update({ id: 1, name: "Published", owner: "alice" }, { columns: ["name"], onMissing: "fail" });
	// @ts-expect-error Composite updates require every key component.
	owned.update({ id: 1, name: "Published" }, { columns: ["name"] });
	// @ts-expect-error No component of a composite key can be assigned.
	owned.update(row, { columns: ["owner"] });
	const versioned = yield* makeRepository(Row, { ...options, versionColumn: "version" });
	versioned.update(row);
	versioned.updateVoid(row);
	// @ts-expect-error Column selection cannot bypass optimistic concurrency.
	versioned.update(row, { columns: ["name"] });
});

it("repository update inputs retain model fields and services", () => {
	expectTypeOf(program).toBeObject();
});
