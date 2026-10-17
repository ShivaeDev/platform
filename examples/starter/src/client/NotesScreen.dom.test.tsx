import { notesRoute, screens } from "#test-support/screens.ts";

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
