import { Schema } from "effect";
import { expect, it } from "vitest";
import { roundTrip } from "#test/roundTrip.ts";
import { PRIMITIVE_SCHEMAS } from "#wireForms.ts";

const NumberWire = Schema[PRIMITIVE_SCHEMAS.Number];

for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0.1, Number.MAX_SAFE_INTEGER]) {
	it(`number ${value} arrives as itself`, () => {
		expect(roundTrip(NumberWire, value)).toBe(value);
	});
}

it("number -0 arrives as 0, because JSON has no -0", () => {
	expect(roundTrip(NumberWire, -0)).toBe(0);
});
