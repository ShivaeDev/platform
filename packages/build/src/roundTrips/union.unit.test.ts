import { Schema } from "effect";
import { expect, it } from "vitest";
import { roundTrip } from "#test/roundTrip.ts";

const Event = Schema.Union([
	Schema.Struct({ id: Schema.Number, kind: Schema.Literal("created") }),
	Schema.Struct({ at: Schema.Date, id: Schema.Number, kind: Schema.Literal("deleted") }),
]);

for (const sent of [
	{ id: 1, kind: "created" },
	{ at: new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 1)), id: 2, kind: "deleted" },
] as const) {
	it(`the ${sent.kind} member of a discriminated union arrives as itself`, () => {
		expect(roundTrip(Event, sent)).toEqual(sent);
	});
}

for (const sent of ["draft", 2, null] as const) {
	it(`the literal ${JSON.stringify(sent)} of a nullable literal union arrives as itself`, () => {
		expect(roundTrip(Schema.NullOr(Schema.Literals(["draft", 2])), sent)).toBe(sent);
	});
}
