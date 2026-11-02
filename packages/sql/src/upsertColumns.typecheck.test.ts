import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { expectTypeOf, it } from "vitest";
import { makeRepository } from "#repository.ts";

class Counter extends Model.Class<Counter>("Counter")({
	count: Schema.Int,
	createdAt: Model.Field({ select: Schema.Date }),
	id: Schema.Int,
	label: Schema.NullOr(Schema.String),
	origin: Model.Field({ insert: Schema.String, select: Schema.String }),
	price: Schema.BigDecimalFromString,
	total: Schema.BigInt,
}) {}

const program = Effect.gen(function* () {
	const rows = yield* makeRepository(Counter, { conflictColumns: ["id"], idColumn: "id", spanPrefix: "Counter", tableName: "counters" });
	const input = {
		count: 1,
		id: 1,
		label: null,
		origin: "import",
		price: yield* Schema.decodeUnknownEffect(Schema.BigDecimalFromString)("1.5"),
		total: 1n,
	};
	const settings = {
		updateColumns: [
			{ column: "count", mode: "add" },
			{ column: "label", mode: "keepOnNull" },
			{ column: "total", mode: "add" },
			{ column: "price", mode: "add" },
		],
	} as const;
	rows.upsert(input, settings);
	rows.upsertMany([input], settings);
	rows.upsert(input, { ...settings, updateWhere: { count: { lt: 10 } } });
	rows.upsertMany([input], { ...settings, updateWhere: { count: { lt: 10 } } });
	// @ts-expect-error Addition requires a numeric decoded field.
	rows.upsert(input, { updateColumns: [{ column: "label", mode: "add" }] });
	// @ts-expect-error Modes cannot change the conflict key.
	rows.upsert(input, { updateColumns: [{ column: "id", mode: "add" }] });
	// @ts-expect-error Modes cannot change a generated field.
	rows.upsertMany([input], { updateColumns: [{ column: "createdAt", mode: "keepOnNull" }] });
	// @ts-expect-error Modes cannot change an insert-only field.
	rows.upsert(input, { updateColumns: [{ column: "origin", mode: "keepOnNull" }] });
	// @ts-expect-error Modes require a model field.
	rows.upsert(input, { updateColumns: [{ column: "missing", mode: "add" }] });
	// @ts-expect-error The mode is explicit, not a SQL expression.
	rows.upsert(input, { updateColumns: [{ column: "count", mode: "count + excluded.count" }] });
});

it("upsert modes follow updateable model fields and numeric decoded types", () => {
	expectTypeOf(program).toBeObject();
});
