import { Schema } from "effect";
import { expect, it } from "vitest";
import { prototypeOf, roundTrip } from "#test/roundTrip.ts";

class NoteCard extends Schema.Class<NoteCard>("NoteCard")({ id: Schema.Number, title: Schema.String }) {}

it("a Schema class instance arrives as an equal instance of the class", () => {
	const sent = new NoteCard({ id: 1, title: "Plan" });

	const received = roundTrip(NoteCard, sent);

	expect([received, prototypeOf(received)]).toEqual([sent, NoteCard.prototype]);
});
