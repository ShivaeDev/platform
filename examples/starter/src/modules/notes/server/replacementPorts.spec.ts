import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, signedIn } from "#modules/notes/test-support/application.ts";
import { replacementPorts } from "#modules/notes/test-support/replacementPorts.ts";
import { answer } from "#test-support/answers.ts";

app.it(
	"alice imports the title supplied by the host's replacement source",
	[replacementPorts("Replacement source title"), signedIn("alice")],
	function* ({ notesOf }) {
		expect(yield* notesOf("alice").list()).toEqual([]);

		const note = yield* notesOf("alice").import(7);

		expect(yield* notesOf("alice").list()).toEqual([{ ...note, title: "Replacement source title" }]);
	},
	{ clock: "live" },
);

app.it(
	"the host's replacement quota refuses alice's second note and keeps her first",
	[replacementPorts("Unused source title"), signedIn("alice")],
	function* ({ notesOf }) {
		const first = yield* notesOf("alice").create("First note");

		const second = yield* answer(notesOf("alice").create("Over quota"));

		yield* outcomes([
			["alice's second create", () => Effect.succeed(second), "too many requests"],
			["alice's notes", () => notesOf("alice").list(), [first]],
		]);
	},
	{ clock: "live" },
);

app.it(
	"when the host's replacement note queue refuses enqueue, alice's create fails and saves no note",
	[replacementPorts("Unused source title", { failEnqueue: true }), signedIn("alice")],
	function* ({ notesOf }) {
		const created = yield* answer(notesOf("alice").create("Rejected by the replacement queue"));

		yield* outcomes([
			["alice's create", () => Effect.succeed(created), "internal server error"],
			["alice's notes", () => notesOf("alice").list(), []],
		]);
	},
	{ clock: "live" },
);
