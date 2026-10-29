import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { lines, noteRemoved, notes, payloads, unstorable } from "#test/drafts.ts";

lines.it(
	"reopening a stored draft takes the server's fresh lines when they were untouched and keeps the edited name",
	[lines.draftsStored(), lines.edited("name", "Local")],
	function* ({ reopen, shownValues }) {
		expect(yield* shownValues()).toEqual({ lines: [{ id: "old" }], name: "Local" });

		yield* reopen({ lines: [{ id: "fresh" }], name: "Remote" });

		expect(yield* shownValues()).toEqual({ lines: [{ id: "fresh" }], name: "Local" });
	},
);

lines.it(
	"reopening a stored draft keeps edited lines and takes the server's new name",
	[lines.draftsStored(), lines.edited("lines", [{ id: "local" }])],
	function* ({ reopen, shownValues }) {
		expect(yield* shownValues()).toEqual({ lines: [{ id: "local" }], name: "First" });

		yield* reopen({ lines: [{ id: "fresh" }], name: "Remote" });

		expect(yield* shownValues()).toEqual({ lines: [{ id: "local" }], name: "Remote" });
	},
);

notes.it(
	"ending the editing session removes its stored draft",
	[notes.sessionOwnsDraft(), notes.edited("name", "Draft")],
	function* ({ endSession, storedDraft }) {
		expect(yield* storedDraft()).toEqual({ name: "Draft" });

		yield* endSession();

		expect(yield* storedDraft()).toBeUndefined();
	},
);

notes.it(
	"after the editing session ends, an edit stores no draft",
	[notes.sessionOwnsDraft(), notes.edited("name", "Draft"), notes.sessionEnded()],
	function* ({ enter, storedDraft }) {
		expect(yield* storedDraft()).toBeUndefined();

		yield* enter("name", "Late edit");

		expect(yield* storedDraft()).toBeUndefined();
	},
);

notes.it(
	"reopening a stored draft keeps a note removed locally",
	[notes.startsWith({ name: "First", note: "Server" }), notes.draftsStored(), noteRemoved()],
	function* ({ reopen, shownValues }) {
		expect(yield* shownValues()).toStrictEqual({ name: "First" });

		yield* reopen({ name: "First", note: "Server" });

		expect(yield* shownValues()).toStrictEqual({ name: "First" });
	},
);

notes.it(
	"reverting a reopened draft restores the server's note",
	[notes.startsWith({ name: "First", note: "Server" }), notes.draftsStored(), noteRemoved(), notes.reopened({ name: "First", note: "Server" })],
	function* ({ revert, shownValues }) {
		expect(yield* shownValues()).toStrictEqual({ name: "First" });

		yield* revert();

		expect(yield* shownValues()).toEqual({ name: "First", note: "Server" });
	},
);

notes.it("reverting removes the stored draft", [notes.draftsStored(), notes.edited("name", "Edited")], function* ({ revert, storedDraft }) {
	expect(yield* storedDraft()).toEqual({ name: "Edited" });

	yield* revert();

	expect(yield* storedDraft()).toBeUndefined();
});

notes.it(
	"reopening a stored draft keeps a note added locally when the server sends none",
	[notes.draftsStored(), notes.edited("note", "Local")],
	function* ({ reopen, shownValues }) {
		expect(yield* shownValues()).toEqual({ name: "First", note: "Local" });

		yield* reopen({ name: "First" });

		expect(yield* shownValues()).toEqual({ name: "First", note: "Local" });
	},
);

payloads.it(
	"an input that cannot be stored removes the earlier stored draft and stays in the form",
	[payloads.draftsStored(), payloads.edited("payload", "Stored")],
	function* ({ enter, shown, storedDraft }) {
		expect(yield* storedDraft()).toEqual({ payload: "Stored" });

		yield* enter("payload", unstorable);

		yield* outcomes({
			"shown payload": [shown("payload"), unstorable],
			"stored draft": [storedDraft(), undefined],
		});
	},
);
