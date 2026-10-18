import { expect } from "vitest";
import { suspended, suspendedDraft } from "#test/suspendedStories.ts";

suspended.it(
	"a canceled suspended transition preserves the visible draft and future persistence",
	[suspendedDraft()],
	function* ({ draft, type, show, staleEdit }) {
		const form = draft().editor().form;
		yield* type("Visible draft");
		const saved = window.localStorage.getItem("transition-draft");
		expect(saved).toContain("Visible draft");
		yield* show("second", true, true);
		expect(draft().attempts).not.toHaveLength(0);
		expect(draft().editor("second").form).not.toBe(form);
		expect(draft().container.querySelector("input")?.value).toBe("Visible draft");
		expect(draft().container.textContent).not.toContain("Loading");
		expect(window.localStorage.getItem("transition-draft")).toBe(saved);
		yield* show("first");
		expect(draft().editor().form).toBe(form);
		yield* type("Continued editing");
		expect(window.localStorage.getItem("transition-draft")).toContain("Continued editing");
		yield* show("second");
		expect(window.localStorage.getItem("transition-draft")).toBeNull();
		yield* type("New session");
		expect(window.localStorage.getItem("transition-draft")).toContain("New session");
		yield* staleEdit(form, "Late old edit");
		expect(window.localStorage.getItem("transition-draft")).toContain("New session");
	},
);

suspended.it(
	"a session replaced while Activity is hidden drops the old draft and activates the new owner",
	[suspendedDraft()],
	function* ({ type, show, draft }) {
		yield* type("Visible draft");
		yield* show("first", false, false, "hidden");
		expect(window.localStorage.getItem("transition-draft")).toContain("Visible draft");
		yield* show("second", false, false, "hidden");
		expect(window.localStorage.getItem("transition-draft")).toBeNull();
		yield* show("second");
		expect(draft().container.querySelector("input")?.value).toBe("Paper");
		yield* type("Revealed draft");
		expect(window.localStorage.getItem("transition-draft")).toContain("Revealed draft");
	},
);
