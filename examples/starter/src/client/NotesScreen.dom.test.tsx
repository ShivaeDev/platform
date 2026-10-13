import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { act } from "react";
import { expect, it, onTestFinished } from "vitest";
import { eventually, expectNoReactWarnings, render } from "@shivaedev/effect-react/testing.ts";
import { notesClient } from "#test-support/notesClient.ts";
import { appRouter } from "./appRouter.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

it("shares the route query, validates the form, retains a rejected title and refreshes after creation", async () => {
	const client = notesClient();
	const view = await render(null);
	onTestFinished(view.unmount);
	const router = appRouter(view.registry, client, createMemoryHistory({ initialEntries: ["/"] }));
	await view.render(<RouterProvider router={router} />);
	await eventually(() => expect(view.container.textContent).toContain("No notes yet"));
	expect(client.calls).toEqual(["list"]);
	async function submit() {
		await act(() => view.container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
	}
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
	await submit();
	await eventually(() => expect(view.container.querySelector("[role=alert]")?.textContent).toBe("Required"));
	expect(client.calls).toEqual(["list"]);
	await enter("reserved");
	await submit();
	await eventually(() => expect(view.container.querySelector("[role=alert]")?.textContent).toBe("Choose another title"));
	expect(view.container.querySelector("input")?.value).toBe("reserved");
	await enter("First note");
	await submit();
	await eventually(() => expect(view.container.querySelector("li > a")?.textContent).toBe("First note"));
	expect(view.container.querySelector("input")?.value).toBe("");
	expect(view.container.querySelector("[role=alert]")).toBeNull();
	expect(client.calls).toEqual(["list", "create", "list"]);
	expect(view.container.querySelector("li")?.textContent).toContain("Counting words…");
	await act(() => client.finishNote(1, 2));
	await eventually(() => expect(view.container.querySelector("li")?.textContent).toContain("2 words"));
	expect(client.calls.filter((call) => call === "list").length).toBeGreaterThan(2);
	await act(() => client.finishNote(1, 1));
	await eventually(() => expect(view.container.querySelector("li")?.textContent).toContain("1 word"));
	expect(view.container.querySelector("li")?.textContent).not.toContain("1 words");
});
