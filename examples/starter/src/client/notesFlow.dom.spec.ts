import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { aliceAccount, notesApp, signInScreen } from "#test-support/notesApp.tsx";

notesApp.it(
	"signs in, creates, opens, saves and deletes a note on screen against PostgreSQL",
	[aliceAccount(), signInScreen()],
	function* ({
		heading,
		storedUsers,
		storedSessions,
		storedNotes,
		enter,
		click,
		route,
		screenText,
		savedNote,
		noteLink,
		draft,
		openListedNote,
		storedNoteIds,
		followLink,
		alert,
	}) {
		yield* Effect.promise(() => eventually(() => expect(heading()).toBe("Sign in")));
		expect(yield* storedUsers).toEqual([{ email: "alice@app.test" }]);
		expect(yield* storedSessions).toEqual([]);
		expect(yield* storedNotes).toEqual([]);
		yield* enter("alice@app.test", "Email");
		yield* enter("correct-horse-battery-staple", "Password");
		yield* click("Sign in");
		yield* Effect.promise(() => eventually(() => expect(heading()).toBe("Notes")));
		yield* Effect.promise(() => eventually(() => expect(route()).toBe("/")));
		yield* Effect.promise(() => eventually(() => expect(screenText()).toContain("No notes yet")));
		expect(yield* storedUsers).toEqual([{ email: "alice@app.test" }]);
		expect(yield* storedSessions).toEqual([{ email: "alice@app.test" }]);
		expect(yield* storedNotes).toEqual([]);
		yield* enter("First note");
		yield* click("Add note");
		yield* Effect.promise(() => eventually(() => expect(noteLink()).toBe("First note")));
		yield* Effect.promise(() => eventually(() => expect(draft()).toBe("")));
		expect(yield* storedNotes).toEqual([{ email: "alice@app.test", title: "First note", version: 0 }]);
		yield* openListedNote();
		yield* Effect.promise(() => eventually(() => expect(heading()).toBe("Edit note")));
		yield* Effect.promise(() => eventually(() => expect(draft()).toBe("First note")));
		const ids = yield* storedNoteIds;
		expect(ids).toHaveLength(1);
		expect(route()).toBe(`/notes/${ids[0]?.id}`);
		expect(yield* storedNotes).toEqual([{ email: "alice@app.test", title: "First note", version: 0 }]);
		yield* enter("  Revised note  ");
		yield* Effect.promise(() => eventually(() => expect(screenText()).toContain("Unsaved changes")));
		expect(yield* storedNotes).toEqual([{ email: "alice@app.test", title: "First note", version: 0 }]);
		yield* click("Save note");
		yield* Effect.promise(() => eventually(() => expect(draft()).toBe("Revised note")));
		yield* Effect.promise(() => eventually(() => expect(screenText()).toContain("All changes saved")));
		yield* Effect.promise(() => eventually(() => expect(alert()).toBeUndefined()));
		expect(yield* storedNotes).toEqual([{ email: "alice@app.test", title: "Revised note", version: 1 }]);
		yield* followLink("Back to notes");
		yield* Effect.promise(() => eventually(() => expect(heading()).toBe("Notes")));
		yield* Effect.promise(() => eventually(() => expect(noteLink()).toBe("Revised note")));
		yield* openListedNote();
		yield* Effect.promise(() => eventually(() => expect(draft()).toBe("Revised note")));
		const reopenedIds = yield* storedNoteIds;
		expect(reopenedIds).toHaveLength(1);
		expect(route()).toBe(`/notes/${reopenedIds[0]?.id}`);
		yield* click("Delete note");
		yield* Effect.promise(() => eventually(() => expect(route()).toBe("/")));
		expect(yield* storedNotes).toEqual([]);
		yield* Effect.promise(() => eventually(() => expect(heading()).toBe("Notes")));
		yield* Effect.promise(() => eventually(() => expect(screenText()).toContain("No notes yet")));
		yield* Effect.promise(() => eventually(() => expect(savedNote()).toBeNull()));
		expect(yield* storedUsers).toEqual([{ email: "alice@app.test" }]);
		expect(yield* storedSessions).toEqual([{ email: "alice@app.test" }]);
	},
);
