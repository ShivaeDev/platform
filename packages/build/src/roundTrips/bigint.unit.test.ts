import { Schema } from "effect";
import { expect, it } from "vitest";
import { roundTrip } from "#test/roundTrip.ts";
import { PRIMITIVE_SCHEMAS } from "#wireForms.ts";

for (const value of [9_007_199_254_740_993n, -18_446_744_073_709_551_616n, 0n]) {
	it(`bigint ${value} arrives as itself`, () => {
		expect(roundTrip(Schema[PRIMITIVE_SCHEMAS.BigInt], value)).toBe(value);
	});
}
