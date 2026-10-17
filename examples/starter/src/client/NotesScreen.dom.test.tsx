import { heldNotesList, notesRoute, notesScreen, screens } from "#test-support/screens.ts";

screens.it(
	"shares the route query, validates the form, retains a rejected title and refreshes after creation",
	[notesRoute()],
	function* ({ screenSays, noteCallsAre, submit, alertSays, enter, draftIs, noteLinkIs, noAlert, wordCountIs, finishWordCount, queryRefreshed }) {
		yield* screenSays("No notes yet");
		yield* noteCallsAre("list");
		yield* submit();
		yield* alertSays("Required");
		yield* noteCallsAre("list");
		yield* enter("reserved");
		yield* submit();
		yield* alertSays("Choose another title");
		yield* draftIs("reserved");
		yield* enter("First note");
		yield* submit();
		yield* noteLinkIs("First note");
		yield* draftIs("");
		yield* noAlert();
		yield* noteCallsAre("list", "create", "list");
		yield* wordCountIs(null);
		yield* finishWordCount(2);
		yield* wordCountIs(2);
		yield* queryRefreshed("list", 2);
		yield* finishWordCount(1);
		yield* wordCountIs(1);
	},
);

screens.it(
	"shows loading before the first result and keeps the empty message during a refresh",
	[heldNotesList(), notesScreen()],
	function* ({
		notesListIsPending,
		notesListIsReady,
		notesLoadingIs,
		screenOmits,
		releaseNotesList,
		screenSays,
		holdNotesList,
		click,
		queryCountIs,
	}) {
		yield* notesListIsPending();
		yield* notesLoadingIs(true);
		yield* screenOmits("No notes yet");
		yield* releaseNotesList();
		yield* notesListIsReady();
		yield* screenSays("No notes yet");
		yield* notesLoadingIs(false);
		yield* holdNotesList();
		yield* click("Refresh");
		yield* queryCountIs("list", 2);
		yield* notesListIsPending();
		yield* screenSays("No notes yet");
		yield* notesLoadingIs(false);
		yield* releaseNotesList();
		yield* notesListIsReady();
		yield* screenSays("No notes yet");
	},
);

screens.it(
	"keeps the listed note without a loading message during manual and live-hint refreshes",
	[notesRoute()],
	function* ({
		screenSays,
		enter,
		submit,
		noteLinkIs,
		holdNotesList,
		click,
		queryCountIs,
		notesListIsPending,
		notesListIsReady,
		notesLoadingIs,
		releaseNotesList,
		finishWordCount,
		wordCountIs,
		queryRefreshed,
	}) {
		yield* screenSays("No notes yet");
		yield* enter("First note");
		yield* submit();
		yield* noteLinkIs("First note");
		yield* holdNotesList();
		yield* click("Refresh");
		yield* queryCountIs("list", 3);
		yield* notesListIsPending();
		yield* noteLinkIs("First note");
		yield* notesLoadingIs(false);
		yield* releaseNotesList();
		yield* notesListIsReady();
		yield* wordCountIs(null);
		yield* holdNotesList();
		yield* finishWordCount(2);
		yield* queryRefreshed("list", 3);
		yield* notesListIsPending();
		yield* noteLinkIs("First note");
		yield* wordCountIs(null);
		yield* notesLoadingIs(false);
		yield* releaseNotesList();
		yield* notesListIsReady();
		yield* wordCountIs(2);
	},
);
