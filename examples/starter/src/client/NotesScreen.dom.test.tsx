import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { act } from "react";
import { expect, onTestFinished } from "vitest";
import { eventually, expectNoReactWarnings, render } from "@shivaedev/effect-react/testing.ts";
import { notesClient } from "#test-support/notesClient.ts";
import { screens } from "#test-support/screens.ts";
import { appRouter } from "./appRouter.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

screens.it(
	"shares the route query, validates the form, retains a rejected title and refreshes after creation",
	[],
	function* ({ interact, enter, submit }) {
		yield* interact(async () => {
			const client = notesClient();
			const view = await render(null);
			onTestFinished(view.unmount);
			const router = appRouter(view.registry, client, createMemoryHistory({ initialEntries: ["/"] }));
			await view.render(<RouterProvider router={router} />);
			await eventually(() => expect(view.container.textContent).toContain("No notes yet"));
			expect(client.calls).toEqual(["list"]);

			await submit(view.container);
			await eventually(() => expect(view.container.querySelector("[role=alert]")?.textContent).toBe("Required"));
			expect(client.calls).toEqual(["list"]);
			await enter(view.container, "reserved");
			await submit(view.container);
			await eventually(() => expect(view.container.querySelector("[role=alert]")?.textContent).toBe("Choose another title"));
			expect(view.container.querySelector("input")?.value).toBe("reserved");
			await enter(view.container, "First note");
			await submit(view.container);
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
	},
);
