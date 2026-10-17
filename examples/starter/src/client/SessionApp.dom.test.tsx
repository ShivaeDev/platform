import { aliceSession, screens } from "#test-support/screens.ts";

screens.it(
	"replaces cached notes and the draft when the authentication owner's session changes",
	[aliceSession()],
	function* ({ noteCallsAre, enter, submit, noteLinkIs, switchSession, noSavedNotes, draftIs }) {
		yield* noteCallsAre("list");
		yield* enter("Alice's saved note");
		yield* submit();
		yield* noteLinkIs("Alice's saved note");
		yield* enter("Alice's private draft");
		yield* switchSession("bob");
		yield* noteCallsAre("list");
		yield* noSavedNotes();
		yield* draftIs("");
	},
);
