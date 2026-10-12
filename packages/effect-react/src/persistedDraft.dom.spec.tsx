import { Effect } from "effect";
import { act } from "react";
import { expect, it, vi } from "vitest";
import { draftStorage } from "#test/draftStorage.ts";
import { persistedDraftView } from "#test/persistedDraftView.tsx";
import { eventually, expectNoReactWarnings } from "#testing.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
draftStorage();

it("restores encoded input across a root reload, while fresh untouched fields and revert use the latest row", async () => {
	const first = await persistedDraftView();
	await first.change("name", "Typed answer");
	expect(window.localStorage.getItem("order-draft")).toContain("Typed answer");
	await first.unmount();
	const reloaded = await persistedDraftView();
	try {
		expect(reloaded.container.querySelector("input")?.value).toBe("Typed answer");
		await reloaded.refresh({ name: "Remote", quantity: "350" });
		expect(reloaded.editor().form.values.value).toEqual({ name: "Typed answer", quantity: "350" });
		await act(async () => reloaded.editor().form.revert());
		expect(reloaded.editor().form.values.value).toEqual({ name: "Remote", quantity: "350" });
		expect(window.localStorage.getItem("order-draft")).toBeNull();
	} finally {
		await reloaded.unmount();
	}
});

it("a query refresh during an edit persists the merged input for the next reload", async () => {
	const first = await persistedDraftView();
	await first.change("name", "Local");
	await first.refresh({ name: "Remote", quantity: "350" });
	expect(JSON.parse(window.localStorage.getItem("order-draft") ?? "null").values).toEqual({ name: "Local", quantity: "350" });
	await first.unmount();
	const reloaded = await persistedDraftView();
	try {
		expect(reloaded.editor().form.values.value).toEqual({ name: "Local", quantity: "300" });
		expect(reloaded.editor().dirty).toBe(true);
	} finally {
		await reloaded.unmount();
	}
});

it("clears a successful submission from storage and does not restore it on reload", async () => {
	const first = await persistedDraftView();
	await first.change("name", "Saved answer");
	expect(window.localStorage.getItem("order-draft")).not.toBeNull();
	await first.save();
	await eventually(() => expect(first.editor().dirty).toBe(false));
	expect(window.localStorage.getItem("order-draft")).toBeNull();
	await first.unmount();
	const reloaded = await persistedDraftView();
	try {
		expect(reloaded.container.querySelector("input")?.value).toBe("Paper");
	} finally {
		await reloaded.unmount();
	}
});

it("session replacement drops visited drafts, including an unmounted screen, and prevents an old form from writing again", async () => {
	const view = await persistedDraftView();
	try {
		await view.change("name", "First session");
		const old = view.editor().form;
		await view.show("first", false);
		expect(window.localStorage.getItem("order-draft")).toContain("First session");
		await view.show("second", false);
		expect(window.localStorage.getItem("order-draft")).toBeNull();
		await view.show("second");
		expect(view.container.querySelector("input")?.value).toBe("Paper");
		await view.change("name", "Second session");
		old.change("name", "Late first session edit");
		expect(window.localStorage.getItem("order-draft")).toContain("Second session");
		await view.show(undefined);
		expect(window.localStorage.getItem("order-draft")).toBeNull();
		expect(view.container.textContent).toBe("Signed out");
	} finally {
		await view.unmount();
	}
});

it.each(["getter", "read", "write", "remove"])("unavailable storage (%s) never breaks editing, refreshing, or saving", async (failure) => {
	const storage = {
		getItem: vi.fn(() => {
			if (failure === "read") {
				throw new Error("Denied");
			}
			return null;
		}),
		removeItem: vi.fn(() => {
			if (failure === "remove") {
				throw new Error("Denied");
			}
		}),
		setItem: vi.fn(() => {
			if (failure === "write") {
				throw new Error("Quota");
			}
		}),
	};
	const getStorage = vi.fn(() => {
		if (failure === "getter") {
			throw new Error("Denied");
		}
		return storage;
	});
	const view = await persistedDraftView({ key: "unavailable", storage: getStorage });
	try {
		expect(getStorage).toHaveBeenCalled();
		await view.change("name", "Local");
		await view.refresh({ name: "Remote", quantity: "350" });
		expect(view.editor().form.values.value).toEqual({ name: "Local", quantity: "350" });
		await view.save();
		await eventually(() => expect(view.editor().dirty).toBe(false));
		await view.show(undefined);
	} finally {
		await view.unmount();
	}
});

it("failed submissions and invalid encoded input remain persisted", async () => {
	const first = await persistedDraftView(undefined, () => Effect.fail("Rejected"));
	await first.change("name", "Rejected answer");
	await first.save();
	await eventually(() => expect(first.editor().failure._tag).toBe("Some"));
	expect(window.localStorage.getItem("order-draft")).toContain("Rejected answer");
	await first.change("quantity", "-");
	await first.change("name", "");
	await first.unmount();
	const reloaded = await persistedDraftView();
	try {
		expect(reloaded.editor().form.values.value).toEqual({ name: "", quantity: "-" });
	} finally {
		await reloaded.unmount();
	}
});
