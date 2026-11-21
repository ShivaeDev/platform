import { expect } from "vitest";
import { app, signedIn } from "#modules/notes/test-support/application.ts";
import { recordingStore } from "#modules/notes/test-support/recordingStore.ts";

app.it(
	"the auth mount and the notes create command spend their budgets in the one store the registrations provide",
	[recordingStore, signedIn("alice")],
	function* ({ notesOf, signsOut, spentBudgets }) {
		yield* notesOf("alice").create("A budgeted note");
		yield* signsOut("alice");

		expect(yield* spentBudgets()).toEqual(["notes.create", "auth mount"]);
	},
);
