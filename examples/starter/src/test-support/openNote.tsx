import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { act } from "react";
import { expect, onTestFinished } from "vitest";
import { eventually, render } from "@shivaedev/effect-react/testing.ts";
import { appRouter } from "#client/appRouter.tsx";
import { notesClient } from "./notesClient.ts";
import { screenAuth } from "./screenAuth.ts";

export async function openNote(tell: (line: string) => void) {
	const client = notesClient([{ id: 1, title: "First note", version: 0, wordCount: null }]);
	const view = await render(null);
	onTestFinished(view.unmount);
	const router = appRouter(view.registry, client, screenAuth(), createMemoryHistory({ initialEntries: ["/notes/1"] }));
	await view.render(<RouterProvider router={router} />);
	await eventually(() => expect(view.container.querySelector("input")?.value).toBe("First note"));
	async function enter(value: string) {
		tell(`enter ${JSON.stringify(value)} in the title`);
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
		tell(`click ${label}`);
		const button = [...view.container.querySelectorAll("button")].find((candidate) => candidate.textContent === label);
		if (button === undefined) {
			throw new Error(`Missing ${label} button`);
		}
		await act(() => button.click());
	}
	return { click, client, enter, router, view };
}
