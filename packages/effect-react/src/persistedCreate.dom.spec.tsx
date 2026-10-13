import { Deferred, Effect } from "effect";
import { act } from "react";
import { expect, it } from "vitest";
import { draftStorage } from "#test/draftStorage.ts";
import { persistedCreateView } from "#test/persistedCreateView.tsx";
import { eventually, expectNoReactWarnings } from "#testing.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
draftStorage();

it("useCreate restores a draft, clears it on success and resets to the initial input", async () => {
	const first = await persistedCreateView();
	await first.change("New order");
	await first.unmount();
	const reloaded = await persistedCreateView();
	try {
		expect(reloaded.container.querySelector("input")?.value).toBe("New order");
		await reloaded.save();
		await eventually(() => expect(reloaded.container.querySelector("input")?.value).toBe("Paper"));
		expect(window.localStorage.getItem("create-draft")).toBeNull();
	} finally {
		await reloaded.unmount();
	}
});

it("useCreate carries edits made during a save into the reset form and its persisted draft", async () => {
	const complete = Effect.runSync(Deferred.make<void>());
	const view = await persistedCreateView((values) => Deferred.await(complete).pipe(Effect.as(values)));
	await view.change("Submitted");
	await view.save();
	await eventually(() => expect(view.saving()).toBe(true));
	await view.change("Later edit");
	await act(async () => {
		await Effect.runPromise(Deferred.succeed(complete, undefined));
	});
	await eventually(() => expect(window.localStorage.getItem("create-draft")).toContain("Later edit"));
	await view.unmount();
	const reloaded = await persistedCreateView();
	try {
		expect(reloaded.form().values.value.name).toBe("Later edit");
	} finally {
		await reloaded.unmount();
	}
});

it.each([false, true])("the create adapter and direct usePersistedDraft hook attach session ownership (%s)", async (direct) => {
	const view = await persistedCreateView(undefined, direct);
	const key = direct ? "direct-draft" : "create-draft";
	try {
		await view.change("First session");
		expect(window.localStorage.getItem(key)).toContain("First session");
		await view.show("second");
		expect(window.localStorage.getItem(key)).toBeNull();
		expect(view.form().values.value.name).toBe("Paper");
	} finally {
		await view.unmount();
	}
});
