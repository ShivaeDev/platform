import { expect } from "@effect/vitest";
import { cyclic, lines, optionalNotes, payloads, untouchedLinesDraft } from "#test/drafts.ts";

lines.it("reload adopts fresh untouched arrays without mistaking JSON's new references for edits", [untouchedLinesDraft()], ({ draftState }) => {
	expect(draftState().values).toEqual({ lines: [{ id: "fresh" }], name: "Local" });
});

lines.it("reload preserves an edited array while adopting a fresh untouched string", [lines.persisted()], ({ form, reload }) => {
	form.change("lines", [{ id: "local" }]);
	const reloaded = reload({ lines: [{ id: "fresh" }], name: "Remote" });
	expect(reloaded.values.value).toEqual({ lines: [{ id: "local" }], name: "Remote" });
});

optionalNotes.it(
	"an explicit core session drops its draft and disables future writes from its form",
	[optionalNotes.sessionOwned()],
	({ form, saved, dropSession }) => {
		form.change("name", "Draft");
		expect(saved.size).toBe(1);
		dropSession();
		expect(saved.size).toBe(0);
		form.change("name", "Late edit");
		expect(saved.size).toBe(0);
	},
);

optionalNotes.it(
	"restores a locally removed optional field without restoring the old key",
	[optionalNotes.withValues({ name: "First", note: "Server" }), optionalNotes.persisted()],
	({ form, reload, saved }) => {
		form.values.set({ name: "Edited" });
		expect(saved.get("draft")).toContain("Edited");
		const reloaded = reload({ name: "First", note: "Server" });
		expect(reloaded.values.value).toEqual({ name: "Edited" });
		reloaded.revert();
		expect(reloaded.values.value).toEqual({ name: "First", note: "Server" });
		expect(saved.size).toBe(0);
	},
);

optionalNotes.it("restores a locally added optional field against a baseline that omits it", [optionalNotes.persisted()], ({ form, reload }) => {
	form.change("note", "Local");
	const reloaded = reload({ name: "First" });
	expect(reloaded.values.value).toEqual({ name: "First", note: "Local" });
});

payloads.it(
	"a serialization failure removes the stale persisted snapshot and leaves the current input intact",
	[payloads.persisted()],
	({ form, saved }) => {
		form.change("payload", "Stored");
		expect(saved.get("draft")).toContain("Stored");
		form.change("payload", cyclic);
		expect(form.values.value.payload).toBe(cyclic);
		expect(saved.size).toBe(0);
	},
);
