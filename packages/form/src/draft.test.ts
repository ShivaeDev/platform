import { expect } from "@effect/vitest";
import { draftNames, optionalNotes, stock } from "#test/drafts.ts";

draftNames.it("reverts to the values the server answered last, not to the ones the edit began from", [], ({ form }) => {
	form.values.set({ name: "Edited" });
	form.receive({ name: "Second" });
	expect(form.values.value).toEqual({ name: "Edited" });
	form.revert();
	expect(form.values.value).toEqual({ name: "Second" });
});

draftNames.it("takes an answer straight to the field while the draft is clean", [], ({ form }) => {
	form.receive({ name: "Second" });
	expect(form.values.value).toEqual({ name: "Second" });
});

stock.it("adopts a refreshed value in an untouched field while keeping an edited one", [], ({ form }) => {
	form.values.set({ name: "Copy paper", quantity: "300" });
	form.receive({ name: "Printer paper", quantity: "350" });
	expect(form.values.value).toEqual({ name: "Copy paper", quantity: "350" });
	form.values.set({ name: "Printer paper", quantity: "350" });
	form.revert();
	expect(form.values.value).toEqual({ name: "Printer paper", quantity: "350" });
});

optionalNotes.it("preserves an added optional field when a refresh arrives", [], ({ form }) => {
	form.values.set({ name: "First", note: "Local" });
	form.receive({ name: "Second" });
	expect(form.values.value).toEqual({ name: "Second", note: "Local" });
	form.revert();
	expect(form.values.value).toEqual({ name: "Second" });
});

optionalNotes.it(
	"drops an untouched optional field the refreshed values omit",
	[optionalNotes.withValues({ name: "First", note: "Server" })],
	({ form }) => {
		form.values.set({ name: "Edited", note: "Server" });
		form.receive({ name: "Second" });
		expect(form.values.value).toEqual({ name: "Edited" });
		expect(Object.hasOwn(form.values.value, "note")).toBe(false);
	},
);
