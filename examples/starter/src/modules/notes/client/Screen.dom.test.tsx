import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { heldNotesList, listedNote, notesRoute, screens } from "#modules/notes/test-support/screens.ts";

screens.it("the notes route and its screen share one list read", [notesRoute()], function* ({ listReads, settle }) {
	yield* settle();

	expect(yield* listReads()).toBe("one list read");
});

screens.it(
	"the notes screen shows loading until the first list arrives",
	[heldNotesList(), notesRoute()],
	function* ({ addNoteForm, releaseNotesList, settle, shownNotes }) {
		expect(yield* shownNotes()).toEqual(["loading"]);

		yield* releaseNotesList();
		yield* settle();

		yield* outcomes([
			["notes", shownNotes, ["no notes yet"]],
			["add-note form", addNoteForm, "shown"],
		]);
	},
);

for (const title of ["", "   "]) {
	screens.it(
		`a ${title === "" ? "blank" : "whitespace-only"} title asks for a title without saving or reading the list again`,
		[notesRoute()],
		function* ({ alert, enter, listReads, settle, shownNotes, submit }) {
			yield* enter(title);

			yield* submit();
			yield* settle();

			yield* outcomes([
				["alert", alert, "Enter a title"],
				["notes", shownNotes, ["no notes yet"]],
				["list reads", listReads, "one list read"],
			]);
		},
	);
}

screens.it("a title the server refuses shows its reason and stays in the field", [notesRoute()], function* ({ alert, draft, enter, settle, submit }) {
	yield* enter("reserved");

	yield* submit();
	yield* settle();

	yield* outcomes([
		["alert", alert, "Choose another title"],
		["draft", draft, "reserved"],
	]);
});

screens.it(
	"adding a note lists it, clears the field and reads the list again",
	[notesRoute()],
	function* ({ alert, draft, enter, listReads, settle, shownNotes, submit }) {
		yield* settle();
		expect(yield* shownNotes()).toEqual(["no notes yet"]);
		yield* enter("First note");

		yield* submit();
		yield* settle();

		yield* outcomes([
			["notes", shownNotes, ["First note"]],
			["draft", draft, ""],
			["alert", alert, "no alert"],
			["list reads", listReads, "2 list reads"],
		]);
	},
);

for (const [count, shown] of [
	[2, "2 words"],
	[1, "1 word"],
] as const) {
	screens.it(
		`a live hint for a finished count of ${count} shows "${shown}" beside the note`,
		[listedNote(), notesRoute()],
		function* ({ finishWordCount, settle, wordCounts }) {
			expect(yield* wordCounts()).toEqual(["First note: Counting words…"]);

			yield* finishWordCount(count);
			yield* settle();

			expect(yield* wordCounts()).toEqual([`First note: ${shown}`]);
		},
	);
}

for (const { given, trigger, shown } of [
	{ given: [notesRoute()], shown: ["no notes yet"], trigger: "Refresh" },
	{ given: [listedNote(), notesRoute()], shown: ["First note"], trigger: "Refresh" },
	{ given: [listedNote(), notesRoute()], shown: ["First note"], trigger: "live hint" },
] as const) {
	screens.it(
		`while a ${trigger} reloads the list, the screen keeps showing ${shown.join(", ")} with Refresh disabled`,
		given,
		function* ({ click, finishWordCount, holdNotesList, refreshButton, settle, shownNotes, waitForList }) {
			yield* settle();
			expect(yield* shownNotes()).toEqual(shown);
			yield* holdNotesList();

			if (trigger === "Refresh") {
				yield* click("Refresh");
			} else {
				yield* finishWordCount(2);
			}
			yield* waitForList();

			yield* outcomes([
				["notes", shownNotes, shown],
				["Refresh", refreshButton, "disabled"],
			]);
		},
	);
}

screens.it(
	"Refresh is enabled again once the reloaded list arrives",
	[notesRoute()],
	function* ({ click, holdNotesList, refreshButton, releaseNotesList, settle, waitForList }) {
		yield* settle();
		yield* holdNotesList();
		yield* click("Refresh");
		yield* waitForList();
		expect(yield* refreshButton()).toBe("disabled");

		yield* releaseNotesList();
		yield* settle();

		expect(yield* refreshButton()).toBe("enabled");
	},
);
