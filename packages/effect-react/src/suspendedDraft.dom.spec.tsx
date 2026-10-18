import { act } from "react";
import { expect, it } from "vitest";
import { expectNoReactWarnings } from "#client/testing.ts";
import { draftStorage } from "#test/draftStorage.ts";
import { suspendedDraftView } from "#test/suspendedDraftView.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
draftStorage();

it("a suspended, canceled session transition preserves the visible draft and its future persistence", async () => {
	const view = await suspendedDraftView();
	try {
		const form = view.editor().form;
		await act(async () => {
			form.change("name", "Visible draft");
			await Promise.resolve();
		});
		const saved = window.localStorage.getItem("transition-draft");
		expect(saved).toContain("Visible draft");
		await view.show("second", true, true);
		expect(view.attempts).not.toHaveLength(0);
		expect(view.editor("second").form).not.toBe(form);
		expect(view.container.querySelector("input")?.value).toBe("Visible draft");
		expect(view.container.textContent).not.toContain("Loading");
		expect(window.localStorage.getItem("transition-draft")).toBe(saved);
		await view.show("first");
		expect(view.editor().form).toBe(form);
		await act(async () => {
			form.change("name", "Continued editing");
			await Promise.resolve();
		});
		expect(window.localStorage.getItem("transition-draft")).toContain("Continued editing");
		await view.show("second");
		expect(window.localStorage.getItem("transition-draft")).toBeNull();
		await act(async () => {
			view.editor("second").form.change("name", "New session");
			await Promise.resolve();
		});
		expect(window.localStorage.getItem("transition-draft")).toContain("New session");
		form.change("name", "Late old edit");
		expect(window.localStorage.getItem("transition-draft")).toContain("New session");
	} finally {
		await view.unmount();
	}
});

it("a session replacement committed while Activity is hidden drops the old draft and activates the new owner", async () => {
	const view = await suspendedDraftView();
	try {
		await act(async () => {
			view.editor().form.change("name", "Visible draft");
			await Promise.resolve();
		});
		await view.show("first", false, false, "hidden");
		expect(window.localStorage.getItem("transition-draft")).toContain("Visible draft");
		await view.show("second", false, false, "hidden");
		expect(window.localStorage.getItem("transition-draft")).toBeNull();
		await view.show("second");
		expect(view.container.querySelector("input")?.value).toBe("Paper");
		await act(async () => {
			view.editor("second").form.change("name", "Revealed draft");
			await Promise.resolve();
		});
		expect(window.localStorage.getItem("transition-draft")).toContain("Revealed draft");
	} finally {
		await view.unmount();
	}
});
