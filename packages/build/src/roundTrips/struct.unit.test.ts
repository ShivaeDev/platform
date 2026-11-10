import { Schema } from "effect";
import { expect, it } from "vitest";
import { roundTrip } from "#test/roundTrip.ts";

const Note = Schema.Struct({
	pinned: Schema.mutableKey(Schema.Boolean),
	summary: Schema.optionalKey(Schema.String),
	title: Schema.String,
	"two words": Schema.mutableKey(Schema.optionalKey(Schema.Number)),
});

it("a struct without its optional keys arrives without them", () => {
	const received = roundTrip(Note, { pinned: false, title: "Plan" });

	expect(received).toStrictEqual({ pinned: false, title: "Plan" });
});

it("a struct with its optional keys arrives with them", () => {
	const sent = { pinned: true, summary: "", title: "Plan", "two words": 2 };

	expect(roundTrip(Note, sent)).toEqual(sent);
});
