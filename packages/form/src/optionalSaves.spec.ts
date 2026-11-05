import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { noteRemoved, notes } from "#test/drafts.ts";

notes.it(
	"clearing a note survives receive and revert restores the received key",
	[notes.startsWith({ name: "First", note: "Initial" })],
	function* ({ notePresent, omit, refresh, revert, shownValues, unsavedChanges }) {
		yield* omit("note");
		yield* refresh({ name: "Remote", note: "Remote note" });

		yield* outcomes([
			["shown values", () => shownValues(), { name: "Remote" }],
			["note key", () => notePresent(), false],
			["unsaved input", () => unsavedChanges(), true],
		]);

		yield* revert();

		yield* outcomes([
			["reverted values", () => shownValues(), { name: "Remote", note: "Remote note" }],
			["unsaved input", () => unsavedChanges(), false],
		]);
	},
);

notes.it(
	"clearing during a save survives its response as an unsaved omission",
	[notes.startsWith({ name: "First", note: "Initial" }), notes.saveInFlight()],
	function* ({ finishSave, notePresent, omit, shownValues, unsavedChanges }) {
		yield* omit("note");
		yield* finishSave();

		yield* outcomes([
			["shown values", () => shownValues(), { name: "First" }],
			["note key", () => notePresent(), false],
			["unsaved input", () => unsavedChanges(), true],
		]);
	},
);

notes.it(
	"saving an omission after a refresh marks it clean until a present undefined edit",
	[
		notes.startsWith({ name: "First", note: "Initial" }),
		noteRemoved(),
		notes.saveInFlight(),
		notes.refreshReceived({ name: "Remote", note: "Remote note" }),
	],
	function* ({ enter, finishSave, notePresent, shownValues, unsavedChanges }) {
		yield* finishSave();

		yield* outcomes([
			["shown values", () => shownValues(), { name: "Remote" }],
			["note key", () => notePresent(), false],
			["unsaved input", () => unsavedChanges(), false],
		]);

		yield* enter("note", undefined);

		expect(yield* unsavedChanges()).toBe(true);
	},
);

notes.it(
	"reopening a stored omission retains absence and the refreshed sibling",
	[notes.draftsStored(), notes.startsWith({ name: "First", note: "Initial" }), noteRemoved()],
	function* ({ notePresent, reopen, shownValues, unsavedChanges }) {
		yield* reopen({ name: "Remote", note: "Remote note" });

		yield* outcomes([
			["shown values", () => shownValues(), { name: "Remote" }],
			["note key", () => notePresent(), false],
			["unsaved input", () => unsavedChanges(), true],
		]);
	},
);
