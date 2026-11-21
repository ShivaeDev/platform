import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { recordClientStory } from "#test/record-client/story.ts";

recordClientStory.it(
	"a call on a delegated contract that leaves out the subject writes and reads the coach's own journal with no error",
	[],
	function* ({ journal, write }) {
		yield* outcomes([
			["writing for dana", () => write("Ran 5k", "dana"), "reflected"],
			["writing with no subject", () => write("Swam 1k"), "reflected"],
			["dana's journal", () => journal("dana"), "dana: Ran 5k"],
			["journal with no subject", () => journal(), "coach: Swam 1k"],
		]);
	},
);

recordClientStory.it(
	"the coach's client bound to dana writes and reads dana's journal while the plain client on the same socket reads the coach's own",
	[],
	function* ({ boundJournal, boundWrite, journal }) {
		yield* boundWrite("Ran 5k");

		yield* outcomes([
			["dana's journal through the bound client", () => boundJournal(), "dana: Ran 5k"],
			["dana's journal named per call", () => journal("dana"), "dana: Ran 5k"],
			["the coach's own journal", () => journal(), "coach: "],
		]);
	},
);

recordClientStory.it(
	"a journal watched live through the client bound to dana shows the entry dana writes in another tab",
	[],
	function* ({ shownBoundJournal, watchesBoundJournal, writtenElsewhere }) {
		expect(yield* watchesBoundJournal()).toBe("dana: ");

		yield* writtenElsewhere("dana", "Slept 8h");

		expect(yield* shownBoundJournal()).toBe("dana: Slept 8h");
	},
);

recordClientStory.it("a stream opened through the client bound to dana runs as dana", [], function* ({ boundOwner }) {
	expect(yield* boundOwner()).toBe("dana");
});

recordClientStory.it("a query through the client bound to dana that names erin reads erin's journal", [], function* ({ boundJournal, write }) {
	yield* write("Lifted", "erin");

	expect(yield* boundJournal("erin")).toBe("erin: Lifted");
});

recordClientStory.it(
	"a query through the client bound to dana is the per-call query for dana, and binding the client again gives the same write",
	[],
	function* ({ identities }) {
		expect(yield* identities()).toEqual({
			"bound serialization key": "AtomRpc:journal.entries:journal:subject:dana",
			"per-call serialization key": "AtomRpc:journal.entries:journal:subject:dana",
			"query atom": "shared",
			"write run of a second binding": "same",
		});
	},
);
