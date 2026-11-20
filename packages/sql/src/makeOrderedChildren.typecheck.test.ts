import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { expectTypeOf, it } from "vitest";
import { makeOrderedChildren } from "#makeOrderedChildren.ts";

class Day extends Model.Class<Day>("Day")({
	id: Schema.Number,
	planId: Schema.Number,
	position: Schema.Number,
	slug: Schema.String,
	version: Model.Field({ select: Schema.Number, update: Schema.Number }),
}) {}

class Step extends Model.Class<Step>("Step")({
	planId: Schema.Number,
	position: Schema.Number,
	slug: Schema.String,
}) {}

const parent = { parentColumn: "planId", parentTable: "plans", positionColumn: "position" } as const;

it("the ID column defaults to id and keys move and reorder by it, and naming every column still compiles", () => {
	const program = Effect.map(makeOrderedChildren(Day, { ...parent, tableName: "days", versionColumn: "version" }), (order) => order.move);
	expectTypeOf<Parameters<Effect.Success<typeof program>>[1]>().toEqualTypeOf<number>();
	const named = Effect.map(makeOrderedChildren(Day, { ...parent, idColumn: "slug", tableName: "days" }), (order) => order.reorder);
	expectTypeOf<Parameters<Effect.Success<typeof named>>[1]>().toEqualTypeOf<readonly string[]>();
	makeOrderedChildren(Day, {
		...parent,
		idColumn: "id",
		parentIdColumn: "id",
		spanPrefix: "Day",
		tableName: "days",
		versionColumn: "version",
	});
});

it("a model without an id field must name its ID column", () => {
	makeOrderedChildren(Step, { ...parent, idColumn: "slug", tableName: "steps" });
	// @ts-expect-error Step has no id field, so its ordered children must name their ID column.
	makeOrderedChildren(Step, { ...parent, tableName: "steps" });
});
