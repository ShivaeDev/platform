import { Option, Schema } from "effect";
import { expect, it } from "vitest";
import { prototypeOf, roundTrip } from "#test/roundTrip.ts";

for (const sent of [Option.none<number>(), Option.some(1), Option.some(Number.NaN)]) {
	it(`${String(sent)} arrives as an equal Option`, () => {
		const received = roundTrip(Schema.Option(Schema.Number), sent);

		expect([received, prototypeOf(received)]).toEqual([sent, prototypeOf(sent)]);
	});
}
