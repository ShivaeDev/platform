import { Schema } from "effect";
import { expect, it } from "vitest";
import { roundTrip } from "#test/roundTrip.ts";

for (const [label, schema] of [
	["readonly array", Schema.Array(Schema.String)],
	["mutable array", Schema.mutable(Schema.Array(Schema.String))],
] as const) {
	it(`an empty ${label} arrives empty`, () => {
		expect(roundTrip(schema, [])).toEqual([]);
	});

	it(`a ${label} arrives with its items in order`, () => {
		expect(roundTrip(schema, ["b", "a", "b"])).toEqual(["b", "a", "b"]);
	});
}

it("a tuple arrives with each element in its place", () => {
	expect(roundTrip(Schema.mutable(Schema.Tuple([Schema.Number, Schema.Literal("a")])), [Number.NaN, "a"])).toEqual([Number.NaN, "a"]);
});
