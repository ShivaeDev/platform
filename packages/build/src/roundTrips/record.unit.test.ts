import { Schema } from "effect";
import { expect, it } from "vitest";
import { roundTrip } from "#test/roundTrip.ts";

for (const sent of [{}, { "": 1, "a b": Number.POSITIVE_INFINITY }]) {
	it(`the record ${JSON.stringify(sent)} arrives with the same keys and values`, () => {
		expect(roundTrip(Schema.Record(Schema.String, Schema.mutableKey(Schema.Number)), sent)).toEqual(sent);
	});
}
