import { expect } from "vitest";
import { drafts, persistedDraft, unavailableDraft } from "#test/draftStories.ts";

drafts.it(
	"restores encoded input across reload; untouched fields and revert use the latest row",
	[persistedDraft()],
	function* ({ type, reload, draft, refresh, revert }) {
		yield* type("name", "Typed answer");
		expect(window.localStorage.getItem("order-draft")).toContain("Typed answer");
		yield* reload();
		expect(draft().container.querySelector("input")?.value).toBe("Typed answer");
		yield* refresh({ name: "Remote", quantity: "350" });
		expect(draft().editor().form.values.value).toEqual({ name: "Typed answer", quantity: "350" });
		yield* revert();
		expect(draft().editor().form.values.value).toEqual({ name: "Remote", quantity: "350" });
		expect(window.localStorage.getItem("order-draft")).toBeNull();
	},
);

drafts.it("a query refresh persists merged input for the next reload", [persistedDraft()], function* ({ type, refresh, reload, draft }) {
	yield* type("name", "Local");
	yield* refresh({ name: "Remote", quantity: "350" });
	expect(JSON.parse(window.localStorage.getItem("order-draft") ?? "null").values).toEqual({ name: "Local", quantity: "350" });
	yield* reload();
	expect(draft().editor().form.values.value).toEqual({ name: "Local", quantity: "300" });
	expect(draft().editor().dirty).toBe(true);
});

drafts.it("clears a successful submission and does not restore it", [persistedDraft()], function* ({ type, submit, observe, draft, reload }) {
	yield* type("name", "Saved answer");
	expect(window.localStorage.getItem("order-draft")).not.toBeNull();
	yield* submit();
	yield* observe("the draft is saved", () => expect(draft().editor().dirty).toBe(false));
	expect(window.localStorage.getItem("order-draft")).toBeNull();
	yield* reload();
	expect(draft().container.querySelector("input")?.value).toBe("Paper");
});

drafts.it(
	"session replacement drops visited drafts and prevents old forms writing again",
	[persistedDraft()],
	function* ({ type, draft, show, staleEdit }) {
		yield* type("name", "First session");
		const old = draft().editor().form;
		yield* show("first", false);
		expect(window.localStorage.getItem("order-draft")).toContain("First session");
		yield* show("second", false);
		expect(window.localStorage.getItem("order-draft")).toBeNull();
		yield* show("second");
		expect(draft().container.querySelector("input")?.value).toBe("Paper");
		yield* type("name", "Second session");
		yield* staleEdit(old, "Late first session edit");
		expect(window.localStorage.getItem("order-draft")).toContain("Second session");
		yield* show(undefined);
		expect(window.localStorage.getItem("order-draft")).toBeNull();
		expect(draft().container.textContent).toBe("Signed out");
	},
);

for (const failure of ["getter", "read", "write", "remove"]) {
	drafts.it(
		`unavailable storage (${failure}) permits editing, refreshing and saving`,
		[unavailableDraft(failure)],
		function* ({ type, refresh, draft, submit, observe, show, storage }) {
			expect(storage()).toHaveBeenCalled();
			yield* type("name", "Local");
			yield* refresh({ name: "Remote", quantity: "350" });
			expect(draft().editor().form.values.value).toEqual({ name: "Local", quantity: "350" });
			yield* submit();
			yield* observe("the draft is saved", () => expect(draft().editor().dirty).toBe(false));
			yield* show(undefined);
		},
	);
}

drafts.it(
	"failed submissions and invalid encoded input remain persisted",
	[persistedDraft(undefined, "rejected")],
	function* ({ type, submit, observe, draft, reload }) {
		yield* type("name", "Rejected answer");
		yield* submit();
		yield* observe("the save failed", () => expect(draft().editor().failure._tag).toBe("Some"));
		expect(window.localStorage.getItem("order-draft")).toContain("Rejected answer");
		yield* type("quantity", "-");
		yield* type("name", "");
		yield* reload();
		expect(draft().editor().form.values.value).toEqual({ name: "", quantity: "-" });
	},
);
