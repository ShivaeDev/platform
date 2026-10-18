import { aliceAccount, notesApp, signInScreen } from "#test-support/notesApp.tsx";

notesApp.it(
	"signs in, creates, opens, saves and deletes a note on screen against PostgreSQL",
	[aliceAccount(), signInScreen()],
	function* ({
		headingIs,
		sessionIsStored,
		notesAreStored,
		enter,
		click,
		routeIs,
		screenSays,
		noSavedNotes,
		noteLinkIs,
		draftIs,
		openListedNote,
		openedNoteIsStored,
		followLink,
		noAlert,
	}) {
		yield* headingIs("Sign in");
		yield* sessionIsStored(false);
		yield* notesAreStored();
		yield* enter("alice@app.test", "Email");
		yield* enter("correct-horse-battery-staple", "Password");
		yield* click("Sign in");
		yield* headingIs("Notes");
		yield* routeIs("/");
		yield* screenSays("No notes yet");
		yield* sessionIsStored(true);
		yield* notesAreStored();
		yield* enter("First note");
		yield* click("Add note");
		yield* noteLinkIs("First note");
		yield* draftIs("");
		yield* notesAreStored({ title: "First note", version: 0 });
		yield* openListedNote();
		yield* headingIs("Edit note");
		yield* draftIs("First note");
		yield* openedNoteIsStored();
		yield* notesAreStored({ title: "First note", version: 0 });
		yield* enter("  Revised note  ");
		yield* screenSays("Unsaved changes");
		yield* notesAreStored({ title: "First note", version: 0 });
		yield* click("Save note");
		yield* draftIs("Revised note");
		yield* screenSays("All changes saved");
		yield* noAlert();
		yield* notesAreStored({ title: "Revised note", version: 1 });
		yield* followLink("Back to notes");
		yield* headingIs("Notes");
		yield* noteLinkIs("Revised note");
		yield* openListedNote();
		yield* draftIs("Revised note");
		yield* openedNoteIsStored();
		yield* click("Delete note");
		yield* routeIs("/");
		yield* notesAreStored();
		yield* headingIs("Notes");
		yield* screenSays("No notes yet");
		yield* noSavedNotes();
		yield* sessionIsStored(true);
	},
);
