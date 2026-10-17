import { editingNote, noteRevisedElsewhere, screens } from "#test-support/screens.ts";

screens.it(
	"shares the typed detail route's query and retains an edit through a live refresh",
	[editingNote()],
	function* ({ noteCallsAre, enter, reviseNote, cachedTitleIs, queryRefreshed, draftIs, screenSays }) {
		yield* noteCallsAre("get");
		yield* enter("Keep my draft");
		yield* reviseNote("Changed elsewhere");
		yield* cachedTitleIs("Changed elsewhere");
		yield* queryRefreshed("get", 1);
		yield* draftIs("Keep my draft");
		yield* screenSays("Unsaved changes");
	},
);

screens.it(
	"shows a stale edit conflict, keeps the input, then refreshes and saves the reviewed draft",
	[editingNote(), noteRevisedElsewhere("Saved elsewhere")],
	function* ({ enter, click, alertIncludes, draftIs, queryCountIs, noAlert, screenSays }) {
		yield* enter("  My draft  ");
		yield* click("Save note");
		yield* alertIncludes("This note changed");
		yield* draftIs("  My draft  ");
		yield* click("Refresh");
		yield* queryCountIs("get", 2);
		yield* draftIs("  My draft  ");
		yield* click("Save note");
		yield* draftIs("My draft");
		yield* noAlert();
		yield* screenSays("All changes saved");
	},
);

screens.it("retains a field rejection while editing", [editingNote()], function* ({ enter, click, alertSays, draftIs }) {
	yield* enter("reserved");
	yield* click("Save note");
	yield* alertSays("Choose another title");
	yield* draftIs("reserved");
});

screens.it(
	"deletes a note and returns to the refreshed list without it",
	[editingNote()],
	function* ({ visitNotes, noteLinkIs, openListedNote, draftIs, click, routeIs, screenSays, noSavedNotes, noteWasDeleted, queryRefreshed }) {
		yield* visitNotes();
		yield* noteLinkIs("First note");
		yield* openListedNote();
		yield* draftIs("First note");
		yield* click("Delete note");
		yield* routeIs("/");
		yield* screenSays("No notes yet");
		yield* noSavedNotes();
		yield* noteWasDeleted();
		yield* queryRefreshed("list", 1);
	},
);

screens.it(
	"keeps the editor open when deletion conflicts with a newer version",
	[editingNote(), noteRevisedElsewhere("Saved elsewhere")],
	function* ({ click, alertIncludes, routeIs, draftIs }) {
		yield* click("Delete note");
		yield* alertIncludes("This note changed");
		yield* routeIs("/notes/1");
		yield* draftIs("First note");
	},
);
