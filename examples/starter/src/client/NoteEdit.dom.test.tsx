import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { act } from "react";
import { expect, it, onTestFinished } from "vitest";
import { eventually, expectNoReactWarnings, render } from "@shivaedev/effect-react/testing.ts";
import { notesClient } from "#test-support/notesClient.ts";
import { appRouter } from "./appRouter.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

async function openNote() {
	const client = notesClient([{ id: 1, title: "First note", version: 0, wordCount: null }]);
	const view = await render(null);
	onTestFinished(view.unmount);
	const router = appRouter(view.registry, client, createMemoryHistory({ initialEntries: ["/notes/1"] }));
	await view.render(<RouterProvider router={router} />);
	await eventually(() => expect(view.container.querySelector("input")?.value).toBe("First note"));
	async function enter(value: string) {
		const input = view.container.querySelector("input");
		if (!(input instanceof HTMLInputElement)) {
			throw new Error("Missing title input");
		}
		await act(() => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
			input.dispatchEvent(new Event("input", { bubbles: true }));
		});
	}
	async function click(label: string) {
		const button = [...view.container.querySelectorAll("button")].find((candidate) => candidate.textContent === label);
		if (button === undefined) {
			throw new Error(`Missing ${label} button`);
		}
		await act(() => button.click());
	}
	return { click, client, enter, router, view };
}

it("shares the typed detail route's query and retains an edit through a live refresh", async () => {
	const { client, enter, view } = await openNote();
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

it("shows a stale edit conflict, keeps the input, then refreshes and saves the reviewed draft", async () => {
	const { click, client, enter, view } = await openNote();
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

it("retains a field rejection while editing", async () => {
	const { click, enter, view } = await openNote();
	await enter("reserved");
	await click("Save note");
	await eventually(() => expect(view.container.querySelector("[role=alert]")?.textContent).toBe("Choose another title"));
	expect(view.container.querySelector("input")?.value).toBe("reserved");
});

it("deletes a note and returns to the refreshed list without it", async () => {
	const { click, client, router, view } = await openNote();
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

it("keeps the editor open when deletion conflicts with a newer version", async () => {
	const { click, client, router, view } = await openNote();
	await client.reviseNote(1, "Saved elsewhere", false);
	await click("Delete note");
	await eventually(() => expect(view.container.querySelector("[role=alert]")?.textContent).toContain("This note changed"));
	expect(router.state.location.pathname).toBe("/notes/1");
	expect(view.container.querySelector("input")?.value).toBe("First note");
});
