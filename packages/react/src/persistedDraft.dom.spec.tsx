import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	drafts,
	draftTyped,
	firstSessionDraft,
	invalidInputTyped,
	restoredAfterReload,
	typedThenRefreshed,
	unavailableStorage,
} from "#test/draftStories.ts";

drafts.it("a reload restores the stored draft", [draftTyped("name", "Typed answer")], function* ({ fields, reload }) {
	yield* reload();

	expect(yield* fields()).toEqual({ name: "Typed answer", quantity: "300" });
});

drafts.it("a refresh after a reload adopts the newer row's untouched fields", [restoredAfterReload()], function* ({ fields, refresh }) {
	yield* refresh();

	expect(yield* fields()).toEqual({ name: "Typed answer", quantity: "350" });
});

drafts.it("revert returns to the latest row and clears the stored draft", [restoredAfterReload(true)], function* ({ fields, revert, stored }) {
	yield* revert();

	yield* outcomes({
		fields: [fields(), { name: "Remote", quantity: "350" }],
		stored: [stored(), "none"],
	});
});

drafts.it("a query refresh stores the merged input", [draftTyped("name", "Local")], function* ({ refresh, stored }) {
	yield* refresh();

	expect(yield* stored()).toEqual({ name: "Local", quantity: "350" });
});

drafts.it(
	"a reload after a merged refresh restores only the edited field, still unsaved",
	[typedThenRefreshed()],
	function* ({ fields, reload, status }) {
		yield* reload();

		yield* outcomes({
			fields: [fields(), { name: "Local", quantity: "300" }],
			status: [status(), "Unsaved"],
		});
	},
);

drafts.it("a successful save clears the stored draft", [draftTyped("name", "Saved answer")], function* ({ status, stored, submit }) {
	yield* submit();

	yield* outcomes({
		status: [status(), "Saved"],
		stored: [stored(), "none"],
	});
});

drafts.it("hiding the form keeps the session's stored draft", [draftTyped("name", "First session")], function* ({ hideForm, stored }) {
	yield* hideForm();

	expect(yield* stored()).toEqual({ name: "First session", quantity: "300" });
});

drafts.it("replacing the session drops the drafts the old session stored", [firstSessionDraft("hidden")], function* ({ session, stored }) {
	yield* session("second", false);

	expect(yield* stored()).toBe("none");
});

drafts.it("the new session's form opens on the row", [firstSessionDraft("replaced")], function* ({ fields, session }) {
	yield* session("second");

	expect(yield* fields()).toEqual({ name: "Paper", quantity: "300" });
});

drafts.it(
	"a late edit from the old session's form leaves the new session's draft alone",
	[firstSessionDraft("second typed")],
	function* ({ firstFormEdits, stored }) {
		yield* firstFormEdits("Late first session edit");

		expect(yield* stored()).toEqual({ name: "Second session", quantity: "300" });
	},
);

drafts.it("signing out clears the stored draft", [firstSessionDraft("second typed")], function* ({ screenText, session, stored }) {
	yield* session(undefined);

	yield* outcomes({
		screen: [screenText(), "Signed out"],
		stored: [stored(), "none"],
	});
});

for (const failure of ["getter", "read", "write", "remove"] as const) {
	drafts.it(
		`an editor whose storage fails (${failure}) still merges a refresh`,
		[unavailableStorage(failure)],
		function* ({ fields, refresh, storageConsulted }) {
			yield* refresh();

			yield* outcomes({
				fields: [fields(), { name: "Local", quantity: "350" }],
				storage: [storageConsulted(), "consulted"],
			});
		},
	);

	drafts.it(`an editor whose storage fails (${failure}) still saves`, [unavailableStorage(failure)], function* ({ status, submit }) {
		yield* submit();

		expect(yield* status()).toBe("Saved");
	});

	drafts.it(`an editor whose storage fails (${failure}) still signs out`, [unavailableStorage(failure)], function* ({ screenText, session }) {
		yield* session(undefined);

		expect(yield* screenText()).toBe("Signed out");
	});
}

drafts.it(
	"a rejected save keeps the stored draft",
	[draftTyped("name", "Rejected answer", undefined, "rejected")],
	function* ({ saveError, stored, submit }) {
		yield* submit();

		yield* outcomes({
			"save error": [saveError(), "Save failed"],
			stored: [stored(), { name: "Rejected answer", quantity: "300" }],
		});
	},
);

drafts.it("a reload restores input the Schema cannot decode", [invalidInputTyped()], function* ({ fields, reload }) {
	yield* reload();

	expect(yield* fields()).toEqual({ name: "", quantity: "-" });
});
