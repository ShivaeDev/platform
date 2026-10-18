import { Deferred, Effect } from "effect";
import { act } from "react";
import { expect, it } from "vitest";
import { eventually, expectNoReactWarnings } from "#client/testing.ts";
import { draftStorage } from "#test/draftStorage.ts";
import { persistedDraftView } from "#test/persistedDraftView.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
draftStorage();

it("a successful save clears submitted input while later edits survive both its response and a reload", async () => {
	const complete = Effect.runSync(Deferred.make<void>());
	const view = await persistedDraftView(undefined, (values) =>
		Deferred.await(complete).pipe(Effect.as({ name: values.name, quantity: String(values.quantity) })),
	);
	await view.change("name", "Submitted");
	await view.save();
	await eventually(() => expect(view.editor().saving).toBe(true));
	await view.change("name", "Later edit");
	await view.refresh({ name: "Remote", quantity: "350" });
	await act(async () => {
		await Effect.runPromise(Deferred.succeed(complete, undefined));
	});
	await eventually(() => expect(view.editor().saving).toBe(false));
	expect(view.editor().form.values.value.name).toBe("Later edit");
	expect(window.localStorage.getItem("order-draft")).toContain("Later edit");
	await view.unmount();
	const reloaded = await persistedDraftView();
	try {
		expect(reloaded.editor().form.values.value).toEqual({ name: "Later edit", quantity: "300" });
		expect(reloaded.editor().dirty).toBe(true);
	} finally {
		await reloaded.unmount();
	}
});

it("a refresh during a save does not leave the accepted submission in persisted storage", async () => {
	const complete = Effect.runSync(Deferred.make<void>());
	const view = await persistedDraftView(undefined, (values) =>
		Deferred.await(complete).pipe(Effect.as({ name: values.name, quantity: String(values.quantity) })),
	);
	try {
		await view.change("name", "Submitted");
		await view.save();
		await eventually(() => expect(view.editor().saving).toBe(true));
		await view.refresh({ name: "Remote", quantity: "350" });
		await act(async () => {
			await Effect.runPromise(Deferred.succeed(complete, undefined));
		});
		await eventually(() => expect(view.editor().saving).toBe(false));
		expect(window.localStorage.getItem("order-draft")).toBeNull();
	} finally {
		await view.unmount();
	}
});

it("hiding and revealing an Activity keeps its persisted draft and session ownership", async () => {
	const view = await persistedDraftView();
	try {
		await view.change("name", "Retained");
		await view.activity("hidden");
		expect(window.localStorage.getItem("order-draft")).toContain("Retained");
		await view.activity("visible");
		expect(view.editor().form.values.value.name).toBe("Retained");
		await view.show("second");
		expect(window.localStorage.getItem("order-draft")).toBeNull();
	} finally {
		await view.unmount();
	}
});
