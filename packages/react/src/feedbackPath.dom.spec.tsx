import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	feedback,
	firstLoadFailed,
	firstUndoConflictingAfterSecondRestored,
	notesLoading,
	notesShown,
	notesShownWithDraft,
	refreshWaitingWithDraft,
	saveAndTwoRemovalsHeld,
	saveCompleted,
	saveWaitingWithNewerDraft,
} from "#test/feedback-path/story.tsx";

feedback.it("a failed first load offers Retry and publishes Load failed", [notesLoading()], function* ({ failRead, notices, queryError }) {
	yield* failRead();

	yield* outcomes({
		notices: [notices(), ["Load failed"]],
		"query error": [queryError(), "Could not load notes Retry"],
	});
});

feedback.it("Retry reads the notes again and shows them when the server answers", [firstLoadFailed()], function* ({ answerRead, retry, rows }) {
	yield* retry();

	yield* answerRead();

	expect(yield* rows()).toBe("existing");
});

feedback.it(
	"a save the server rejects shows its message on the title field and publishes no notice",
	[notesShown()],
	function* ({ draft, fieldError, notices, saveStatus, submit, type }) {
		yield* type("blocked");

		yield* submit();

		yield* outcomes({
			draft: [draft(), "blocked"],
			"field error": [fieldError(), "Choose another title"],
			notices: [notices(), []],
			"save status": [saveStatus(), "Unsaved"],
		});
	},
);

feedback.it("a submitted save shows Saving while the server holds it", [notesShown()], function* ({ saves, saveStatus, submit, type }) {
	yield* type("new note");

	yield* submit();

	yield* outcomes({
		"save status": [saveStatus(), "Saving"],
		saves: [saves(), ["new note"]],
	});
});

feedback.it(
	"a completed save publishes its notice before its refetch answers and keeps the newer draft",
	[saveWaitingWithNewerDraft()],
	function* ({ completeSave, draft, fieldError, loading, notices, rows, saveStatus }) {
		yield* completeSave();

		yield* outcomes({
			draft: [draft(), "next draft"],
			"field error": [fieldError(), "none"],
			loading: [loading(), "Refreshing notes"],
			notices: [notices(), ["Saved new note"]],
			rows: [rows(), "existing"],
			"save status": [saveStatus(), "Unsaved"],
		});
	},
);

feedback.it("the refetch a save caused shows the saved note", [saveCompleted()], function* ({ answerRead, rows }) {
	yield* answerRead();

	expect(yield* rows()).toBe("existing, new note");
});

feedback.it("Refresh reads again while keeping the draft", [notesShownWithDraft("next draft")], function* ({ draft, loading, reads, refresh }) {
	yield* refresh();

	yield* outcomes({
		draft: [draft(), "next draft"],
		loading: [loading(), "Refreshing notes"],
		reads: [reads(), 2],
	});
});

feedback.it(
	"a failed refresh keeps the shown notes and the draft and publishes Refresh failed",
	[refreshWaitingWithDraft("next draft")],
	function* ({ draft, failRead, notices, queryError, rows }) {
		yield* failRead();

		yield* outcomes({
			draft: [draft(), "next draft"],
			notices: [notices(), ["Refresh failed"]],
			"query error": [queryError(), "Could not load notes Retry"],
			rows: [rows(), "existing"],
		});
	},
);

feedback.it(
	"a removal that completes while a save and another removal are held publishes only its own notice",
	[saveAndTwoRemovalsHeld(false)],
	function* ({ completeRemove, notices, saveStatus }) {
		yield* completeRemove("second");

		yield* outcomes({
			notices: [notices(), ["Removed second"]],
			"save status": [saveStatus(), "Saving"],
		});
	},
);

feedback.it(
	"form and command notices appear in the order their work completes",
	[saveAndTwoRemovalsHeld(true)],
	function* ({ completeRemove, notices }) {
		expect(yield* notices()).toEqual(["Removed second", "Saved concurrent note"]);

		yield* completeRemove("first");

		expect(yield* notices()).toEqual(["Removed second", "Saved concurrent note", "Removed first"]);
	},
);

feedback.it(
	"a conflicting Undo shows its conflict on its own notice while the other notice keeps its restore",
	[firstUndoConflictingAfterSecondRestored()],
	function* ({ completeRestore, notice, restoreCalls }) {
		yield* completeRestore("first");

		yield* outcomes({
			"Removed first": [notice("Removed first"), expect.stringContaining("Conflict")],
			"Removed second": [notice("Removed second"), "Restored second"],
			"restore calls": [
				restoreCalls(),
				[
					{ expectedVersion: 8, title: "second" },
					{ expectedVersion: 8, title: "first" },
				],
			],
		});
	},
);
