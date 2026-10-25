import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { aliceAccount, notesApp, notesHostScreen, signInResponseHeld } from "#modules/notes/test-support/app.tsx";

notesApp.it(
	"signs in, creates, opens, saves and deletes a note on screen against PostgreSQL",
	[aliceAccount(), signInResponseHeld(), notesHostScreen()],
	function* ({
		heading,
		button,
		releaseSignIn,
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
		yield* eventually(() => expect(heading()).toBe("Sign in"));
		expect(yield* storedUsers).toEqual([{ email: "alice@app.test" }]);
		expect(yield* storedSessions).toEqual([]);
		expect(yield* storedNotes).toEqual([]);
		yield* enter("alice@app.test", "Email");
		yield* enter("correct-horse-battery-staple", "Password");
		yield* click("Sign in");
		yield* eventually(() => expect(button("Please wait…")).toEqual({ disabled: true, text: "Please wait…" }));
		expect(heading()).toBe("Sign in");
		yield* releaseSignIn();
		yield* eventually(() => expect(heading()).toBe("Notes"));
		yield* eventually(() => expect(route()).toBe("/"));
		yield* eventually(() => expect(screenText()).toContain("No notes yet"));
		expect(yield* storedUsers).toEqual([{ email: "alice@app.test" }]);
		expect(yield* storedSessions).toEqual([{ email: "alice@app.test" }]);
		expect(yield* storedNotes).toEqual([]);
		yield* enter("First note");
		yield* click("Add note");
		yield* eventually(() => expect(noteLink()).toBe("First note"));
		yield* eventually(() => expect(draft()).toBe(""));
		expect(yield* storedNotes).toEqual([{ email: "alice@app.test", title: "First note", version: 0 }]);
		yield* openListedNote();
		yield* eventually(() => expect(heading()).toBe("Edit note"));
		yield* eventually(() => expect(draft()).toBe("First note"));
		const ids = yield* storedNoteIds;
		expect(ids).toEqual([{ id: expect.any(Number) }]);
		expect(route()).toBe(`/notes/${ids[0]?.id}`);
		expect(yield* storedNotes).toEqual([{ email: "alice@app.test", title: "First note", version: 0 }]);
		yield* enter("  Revised note  ");
		yield* eventually(() => expect(screenText()).toContain("Unsaved changes"));
		expect(yield* storedNotes).toEqual([{ email: "alice@app.test", title: "First note", version: 0 }]);
		yield* click("Save note");
		yield* eventually(() => expect(draft()).toBe("Revised note"));
		yield* eventually(() => expect(screenText()).toContain("All changes saved"));
		yield* eventually(() => expect(alert()).toBeUndefined());
		expect(yield* storedNotes).toEqual([{ email: "alice@app.test", title: "Revised note", version: 1 }]);
		yield* followLink("Back to notes");
		yield* eventually(() => expect(heading()).toBe("Notes"));
		yield* eventually(() => expect(noteLink()).toBe("Revised note"));
		yield* openListedNote();
		yield* eventually(() => expect(draft()).toBe("Revised note"));
		const reopenedIds = yield* storedNoteIds;
		expect(reopenedIds).toEqual(ids);
		expect(route()).toBe(`/notes/${reopenedIds[0]?.id}`);
		yield* click("Delete note");
		yield* eventually(() => expect(route()).toBe("/"));
		expect(yield* storedNotes).toEqual([]);
		yield* eventually(() => expect(heading()).toBe("Notes"));
		yield* eventually(() => expect(screenText()).toContain("No notes yet"));
		yield* eventually(() => expect(savedNote()).toBeNull());
		expect(yield* storedUsers).toEqual([{ email: "alice@app.test" }]);
		expect(yield* storedSessions).toEqual([{ email: "alice@app.test" }]);
		yield* click("Sign out");
		yield* eventually(() => expect(heading()).toBe("Sign in"));
		expect(route()).toBe("/sign-in");
		expect(yield* storedSessions).toEqual([]);
	},
);
