import { DateTime, Schema } from "effect";
import { expect, it } from "vitest";
import { prototypeOf, roundTrip } from "#test/roundTrip.ts";
import { PRIMITIVE_SCHEMAS } from "#wireForms.ts";

it("a DateTime.Utc with milliseconds arrives as an equal DateTime.Utc", () => {
	const sent = DateTime.makeUnsafe(Date.UTC(2026, 10, 10, 9, 30, 15, 123));

	const received = roundTrip(Schema[PRIMITIVE_SCHEMAS.DateTimeUtc], sent);

	expect([received, prototypeOf(received)]).toEqual([sent, prototypeOf(sent)]);
});
