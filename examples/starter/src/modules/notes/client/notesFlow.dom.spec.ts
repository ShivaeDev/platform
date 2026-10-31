import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aliceAccount, notesApp, notesHostScreen, signInResponseHeld } from "#modules/notes/test-support/app.tsx";

notesApp.it(
	"signs in, creates, opens, saves and deletes a note on screen against PostgreSQL",
	[aliceAccount(), signInResponseHeld(), notesHostScreen()],
	function* ({
		settle,
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
		yield* settle();
		yield* outcomes([
			["heading", () => Effect.sync(() => heading()), "Sign in"],
			["stored notes", () => storedNotes, []],
			["stored sessions", () => storedSessions, []],
			["stored users", () => storedUsers, [{ email: "alice@app.test" }]],
		]);
		yield* enter("alice@app.test", "Email");
		yield* enter("correct-horse-battery-staple", "Password");
		yield* click("Sign in");
		expect(button("Please wait…")).toEqual({ disabled: true, text: "Please wait…" });
		expect(heading()).toBe("Sign in");
		yield* releaseSignIn();
		yield* settle();
		expect(heading()).toBe("Notes");
		expect(route()).toBe("/");
		expect(screenText()).toContain("No notes yet");
		yield* outcomes([
			["stored notes", () => storedNotes, []],
			["stored sessions", () => storedSessions, [{ email: "alice@app.test" }]],
			["stored users", () => storedUsers, [{ email: "alice@app.test" }]],
		]);
		yield* enter("First note");
		yield* click("Add note");
		yield* settle();
		expect(noteLink()).toBe("First note");
		yield* outcomes([
			["draft", () => Effect.sync(() => draft()), ""],
			["stored notes", () => storedNotes, [{ email: "alice@app.test", title: "First note", version: 0 }]],
		]);
		yield* openListedNote();
		yield* settle();
		expect(heading()).toBe("Edit note");
		expect(draft()).toBe("First note");
		const ids = yield* storedNoteIds;
		yield* outcomes([
			["ids", () => Effect.sync(() => ids), [{ id: expect.any(Number) }]],
			["route", () => Effect.sync(() => route()), `/notes/${ids[0]?.id}`],
			["stored notes", () => storedNotes, [{ email: "alice@app.test", title: "First note", version: 0 }]],
		]);
		yield* enter("  Revised note  ");
		yield* settle();
		expect(screenText()).toContain("Unsaved changes");
		expect(yield* storedNotes).toEqual([{ email: "alice@app.test", title: "First note", version: 0 }]);
		yield* click("Save note");
		yield* settle();
		expect(draft()).toBe("Revised note");
		expect(screenText()).toContain("All changes saved");
		yield* outcomes([
			["alert", () => Effect.sync(() => alert()), undefined],
			["stored notes", () => storedNotes, [{ email: "alice@app.test", title: "Revised note", version: 1 }]],
		]);
		yield* followLink("Back to notes");
		yield* settle();
		expect(heading()).toBe("Notes");
		expect(noteLink()).toBe("Revised note");
		yield* openListedNote();
		yield* settle();
		expect(draft()).toBe("Revised note");
		const reopenedIds = yield* storedNoteIds;
		expect(reopenedIds).toEqual(ids);
		expect(route()).toBe(`/notes/${reopenedIds[0]?.id}`);
		yield* click("Delete note");
		yield* settle();
		yield* outcomes([
			["route", () => Effect.sync(() => route()), "/"],
			["stored notes", () => storedNotes, []],
		]);
		expect(heading()).toBe("Notes");
		expect(screenText()).toContain("No notes yet");
		yield* outcomes([
			["saved note", () => Effect.sync(() => savedNote()), null],
			["stored sessions", () => storedSessions, [{ email: "alice@app.test" }]],
			["stored users", () => storedUsers, [{ email: "alice@app.test" }]],
		]);
		yield* click("Sign out");
		yield* settle();
		yield* outcomes([
			["heading", () => Effect.sync(() => heading()), "Sign in"],
			["route", () => Effect.sync(() => route()), "/sign-in"],
			["stored sessions", () => storedSessions, []],
		]);
	},
);
