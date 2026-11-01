import { expect } from "vitest";
import { lateSaves, openForm } from "#test/late-save/story.tsx";

for (const submit of ["Save", "Atom submit"]) {
	lateSaves.it(`an edit during ${submit} survives the normalized response`, [openForm("editor")], function* ({ click, finish, shown, type }) {
		yield* type("name", "Submitted");
		yield* click(submit);
		yield* type("name", "Later edit");
		yield* finish();

		expect(yield* shown()).toEqual({ dirty: true, values: { name: "Later edit", note: "Initial note" } });
	});
}

lateSaves.it("reverting after a late save restores the normalized saved baseline", [openForm("editor")], function* ({ click, finish, shown, type }) {
	yield* type("name", "Submitted");
	yield* click("Save");
	yield* type("name", "Later edit");
	yield* finish();
	yield* click("Revert");

	expect(yield* shown()).toEqual({ dirty: false, values: { name: "SUBMITTED", note: "Initial note" } });
});

lateSaves.it(
	"an untouched field receives normalization while a later note stays edited",
	[openForm("editor")],
	function* ({ click, finish, shown, type }) {
		yield* type("name", "Submitted");
		yield* click("Save");
		yield* type("note", "Later note");
		yield* finish();

		expect(yield* shown()).toEqual({ dirty: true, values: { name: "SUBMITTED", note: "Later note" } });
	},
);

lateSaves.it("a late save keeps the newer refresh baseline", [openForm("editor")], function* ({ click, finish, shown, type }) {
	yield* type("name", "Submitted");
	yield* click("Save");
	yield* click("Refresh");
	yield* type("name", "Later edit");
	yield* finish();
	expect(yield* shown()).toEqual({ dirty: true, values: { name: "Later edit", note: "Remote note" } });

	yield* click("Revert");

	expect(yield* shown()).toEqual({ dirty: false, values: { name: "Remote", note: "Remote note" } });
});

lateSaves.it("a create keeps an optional key removed during its save", [openForm("create")], function* ({ click, finish, shown, type }) {
	yield* type("name", "Submitted");
	yield* click("Save");
	yield* click("Remove note");
	yield* finish();

	expect(yield* shown()).toStrictEqual({ dirty: true, values: { name: "First" } });
});

lateSaves.it(
	"typing the refreshed name during a save keeps that newest input clean",
	[openForm("editor")],
	function* ({ click, finish, shown, type }) {
		yield* type("name", "Submitted");
		yield* click("Save");
		yield* click("Refresh");
		yield* type("name", "Remote");
		yield* finish();

		expect(yield* shown()).toEqual({ dirty: false, values: { name: "Remote", note: "Remote note" } });
	},
);
