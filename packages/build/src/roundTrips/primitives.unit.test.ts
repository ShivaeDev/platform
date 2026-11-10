import { Schema } from "effect";
import { expect, it } from "vitest";
import { roundTrip } from "#test/roundTrip.ts";
import { PRIMITIVE_SCHEMAS } from "#wireForms.ts";

const cases = [
	["String", ["", "ü\u0000\n"]],
	["Boolean", [true, false]],
	["Null", [null]],
	["Undefined", [undefined]],
	["Void", [undefined]],
] as const;

for (const [primitive, values] of cases) {
	for (const value of values) {
		it(`${primitive} ${JSON.stringify(value) ?? "undefined"} arrives as itself`, () => {
			expect(roundTrip(Schema[PRIMITIVE_SCHEMAS[primitive]], value)).toBe(value);
		});
	}
}
