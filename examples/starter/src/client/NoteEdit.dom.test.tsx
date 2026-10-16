import * as AsyncResult from "effect/reactivity/AsyncResult";
import { act } from "react";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { editingNote, screens } from "#test-support/screens.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

screens.it("shares the typed detail route's query and retains an edit through a live refresh", [editingNote()], function* ({ interact, editor }) {
	yield* interact(async () => {
		const { client, enter, view } = editor();
		expect(client.calls).toEqual(["get"]);
		await enter("Keep my draft");
		await act(() => client.reviseNote(1, "Changed elsewhere"));
		await eventually(() =>
			expect(AsyncResult.getOrElse(view.registry.get(client.api.get.query({ id: 1 })), () => undefined)?.title).toBe("Changed elsewhere"),
		);
		expect(client.calls.filter((call) => call === "get").length).toBeGreaterThan(1);
		expect(view.container.querySelector("input")?.value).toBe("Keep my draft");
		expect(view.container.textContent).toContain("Unsaved changes");
	});
});

screens.it(
	"shows a stale edit conflict, keeps the input, then refreshes and saves the reviewed draft",
	[editingNote()],
	function* ({ interact, editor }) {
		yield* interact(async () => {
			const { click, client, enter, view } = editor();
			await enter("  My draft  ");
			await client.reviseNote(1, "Saved elsewhere", false);
			await click("Save note");
			await eventually(() => expect(view.container.querySelector("[role=alert]")?.textContent).toContain("This note changed"));
			expect(view.container.querySelector("input")?.value).toBe("  My draft  ");
			await click("Refresh");
			await eventually(() => expect(client.calls.filter((call) => call === "get")).toHaveLength(2));
			expect(view.container.querySelector("input")?.value).toBe("  My draft  ");
			await click("Save note");
			await eventually(() => expect(view.container.querySelector("input")?.value).toBe("My draft"));
			expect(view.container.querySelector("[role=alert]")).toBeNull();
			expect(view.container.textContent).toContain("All changes saved");
		});
	},
);

screens.it("retains a field rejection while editing", [editingNote()], function* ({ interact, editor }) {
	yield* interact(async () => {
		const { click, enter, view } = editor();
		await enter("reserved");
		await click("Save note");
		await eventually(() => expect(view.container.querySelector("[role=alert]")?.textContent).toBe("Choose another title"));
		expect(view.container.querySelector("input")?.value).toBe("reserved");
	});
});

screens.it("deletes a note and returns to the refreshed list without it", [editingNote()], function* ({ interact, editor }) {
	yield* interact(async () => {
		const { click, client, router, view } = editor();
		await act(() => router.navigate({ to: "/" }));
		await eventually(() => expect(view.container.querySelector("li > a")?.textContent).toBe("First note"));
		await act(() => view.container.querySelector<HTMLAnchorElement>("li > a")?.click());
		await eventually(() => expect(view.container.querySelector("input")?.value).toBe("First note"));
		await click("Delete note");
		await eventually(() => expect(router.state.location.pathname).toBe("/"));
		await eventually(() => expect(view.container.textContent).toContain("No notes yet"));
		expect(view.container.querySelector("li")).toBeNull();
		expect(client.calls).toContain("delete");
		expect(client.calls.filter((call) => call === "list").length).toBeGreaterThan(1);
	});
});

screens.it("keeps the editor open when deletion conflicts with a newer version", [editingNote()], function* ({ interact, editor }) {
	yield* interact(async () => {
		const { click, client, router, view } = editor();
		await client.reviseNote(1, "Saved elsewhere", false);
		await click("Delete note");
		await eventually(() => expect(view.container.querySelector("[role=alert]")?.textContent).toContain("This note changed"));
		expect(router.state.location.pathname).toBe("/notes/1");
		expect(view.container.querySelector("input")?.value).toBe("First note");
	});
});
