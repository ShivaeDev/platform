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
	const editing = draft({ quantity: "300", name: "Printer paper" });
	editing.values.set({ quantity: "300", name: "Copy paper" });
	editing.receive({ quantity: "350", name: "Printer paper" });
	expect(editing.values.value).toEqual({ quantity: "350", name: "Copy paper" });
	editing.values.set({ quantity: "350", name: "Printer paper" });
	editing.revert();
	expect(editing.values.value).toEqual({ quantity: "350", name: "Printer paper" });
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
