import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { activityDraft, drafts, draftTyped, laterEditSaved, saveHeld } from "#test/draftStories.ts";

drafts.it(
	"an edit made while a save waits survives the save's success and stays stored",
	[saveHeld(true)],
	function* ({ fields, finishSave, stored }) {
		yield* finishSave();

		yield* outcomes({
			fields: [fields(), { name: "Later edit", quantity: "300" }],
			stored: [stored(), { name: "Later edit", quantity: "300" }],
		});
	},
);

drafts.it("a reload after the save restores the later edit as unsaved", [laterEditSaved()], function* ({ fields, reload, status }) {
	yield* reload();

	yield* outcomes({
		fields: [fields(), { name: "Later edit", quantity: "300" }],
		status: [status(), "Unsaved"],
	});
});

drafts.it("a refresh during a save does not store the accepted submission", [saveHeld(false)], function* ({ finishSave, stored }) {
	yield* finishSave();

	expect(yield* stored()).toBe("none");
});

drafts.it("hiding Activity keeps the stored draft", [draftTyped("name", "Retained")], function* ({ activity, stored }) {
	yield* activity("hidden");

	expect(yield* stored()).toEqual({ name: "Retained", quantity: "300" });
});

drafts.it("revealing Activity shows the retained draft", [activityDraft("hidden")], function* ({ activity, fields }) {
	yield* activity("visible");

	expect(yield* fields()).toEqual({ name: "Retained", quantity: "300" });
});

drafts.it("a session change after Activity was revealed still drops the draft", [activityDraft("revealed")], function* ({ session, stored }) {
	yield* session("second");

	expect(yield* stored()).toBe("none");
});
