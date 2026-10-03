import { expect, it } from "@effect/vitest";
import { draft } from "../src/draft.ts";

it("reverts to the values the server answered last, not to the ones the edit began from", () => {
	const editing = draft({ name: "First" });
	editing.values.set({ name: "Edited" });
	editing.receive({ name: "Second" });
	expect(editing.values.value).toEqual({ name: "Edited" });
	editing.revert();
	expect(editing.values.value).toEqual({ name: "Second" });
});

it("takes an answer straight to the field while the draft is clean", () => {
	const editing = draft({ name: "First" });
	editing.receive({ name: "Second" });
	expect(editing.values.value).toEqual({ name: "Second" });
});

it("adopts a refreshed value in an untouched field while keeping an edited one", () => {
	const editing = draft({ name: "Printer paper", quantity: "300" });
	editing.values.set({ name: "Copy paper", quantity: "300" });
	editing.receive({ name: "Printer paper", quantity: "350" });
	expect(editing.values.value).toEqual({ name: "Copy paper", quantity: "350" });
	editing.values.set({ name: "Printer paper", quantity: "350" });
	editing.revert();
	expect(editing.values.value).toEqual({ name: "Printer paper", quantity: "350" });
});

it("preserves an added optional field when a refresh arrives", () => {
	const editing = draft<{ name: string; note?: string }>({ name: "First" });
	editing.values.set({ name: "First", note: "Local" });
	editing.receive({ name: "Second" });
	expect(editing.values.value).toEqual({ name: "Second", note: "Local" });
	editing.revert();
	expect(editing.values.value).toEqual({ name: "Second" });
});

it("drops an untouched optional field the refreshed values omit", () => {
	const editing = draft<{ name: string; note?: string }>({
		name: "First",
		note: "Server",
	});
	editing.values.set({ name: "Edited", note: "Server" });
	editing.receive({ name: "Second" });
	expect(editing.values.value).toEqual({ name: "Edited" });
	expect(Object.hasOwn(editing.values.value, "note")).toBe(false);
});
