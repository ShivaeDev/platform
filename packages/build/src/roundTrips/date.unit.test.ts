import { Schema } from "effect";
import { expect, it } from "vitest";
import { prototypeOf, roundTrip } from "#test/roundTrip.ts";
import { PRIMITIVE_SCHEMAS } from "#wireForms.ts";

it("a Date with milliseconds arrives as an equal Date", () => {
	const sent = new Date(Date.UTC(2026, 10, 10, 9, 30, 15, 123));

	const received = roundTrip(Schema[PRIMITIVE_SCHEMAS.Date], sent);

	expect([received, prototypeOf(received)]).toEqual([sent, Date.prototype]);
});
