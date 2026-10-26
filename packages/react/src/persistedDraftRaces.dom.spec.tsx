import { expect } from "vitest";
import { drafts, persistedDraft } from "#test/draftStories.ts";

drafts.it(
	"later edits survive a successful save response and reload",
	[persistedDraft(undefined, "held")],
	function* ({ type, submit, observe, draft, refresh, finishSave, reload }) {
		yield* type("name", "Submitted");
		yield* submit();
		yield* observe("saving", () => expect(draft().editor().saving).toBe(true));
		yield* type("name", "Later edit");
		yield* refresh({ name: "Remote", quantity: "350" });
		yield* finishSave();
		yield* observe("saved", () => expect(draft().editor().saving).toBe(false));
		expect(draft().editor().form.values.value.name).toBe("Later edit");
		expect(window.localStorage.getItem("order-draft")).toContain("Later edit");
		yield* reload();
		expect(draft().editor().form.values.value).toEqual({ name: "Later edit", quantity: "300" });
		expect(draft().editor().dirty).toBe(true);
	},
);

drafts.it(
	"a refresh during a save does not persist the accepted submission",
	[persistedDraft(undefined, "held")],
	function* ({ type, submit, observe, draft, refresh, finishSave }) {
		yield* type("name", "Submitted");
		yield* submit();
		yield* observe("saving", () => expect(draft().editor().saving).toBe(true));
		yield* refresh({ name: "Remote", quantity: "350" });
		yield* finishSave();
		yield* observe("saved", () => expect(draft().editor().saving).toBe(false));
		expect(window.localStorage.getItem("order-draft")).toBeNull();
	},
);

drafts.it("hiding and revealing Activity keeps its draft and session ownership", [persistedDraft()], function* ({ type, activity, draft, show }) {
	yield* type("name", "Retained");
	yield* activity("hidden");
	expect(window.localStorage.getItem("order-draft")).toContain("Retained");
	yield* activity("visible");
	expect(draft().editor().form.values.value.name).toBe("Retained");
	yield* show("second");
	expect(window.localStorage.getItem("order-draft")).toBeNull();
});
