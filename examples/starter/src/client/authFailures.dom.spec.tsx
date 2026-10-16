import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { act } from "react";
import { beforeEach, expect, onTestFinished, vi } from "vitest";
import { eventually, render } from "@shivaedev/effect-react/testing.ts";
import { Unauthorized } from "@shivaedev/platform/errors/taxonomy.ts";
import { notesClient } from "#test-support/notesClient.ts";
import { screens } from "#test-support/screens.ts";
import { appRouter } from "./appRouter.tsx";
import { NotesScreen } from "./NotesScreen.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
let expectedErrors: readonly (readonly unknown[])[] = [];
beforeEach(() => {
	expectedErrors = [];
	const errors = vi.spyOn(console, "error");
	onTestFinished(() => {
		const calls = errors.mock.calls;
		errors.mockRestore();
		expect(calls).toEqual(expectedErrors);
	});
});

screens.it("shows the protected route's typed Unauthorized failure and links to sign-in", [], function* ({ interact }) {
	yield* interact(async () => {
		const client = notesClient();
		client.session.signedIn = false;
		expectedErrors = [
			[
				expect.any(String),
				new Unauthorized({ message: "Authentication required" }),
				"The above error occurred in the <MatchInnerImpl> component.",
				"React will try to recreate this component tree from scratch using the error boundary you provided, CatchBoundary.",
			],
		];
		const view = await render(null);
		onTestFinished(view.unmount);
		const router = appRouter(view.registry, client, createMemoryHistory({ initialEntries: ["/"] }));
		await view.render(<RouterProvider router={router} />);
		await eventually(() => expect(view.container.querySelector("[role=alert]")?.textContent).toBe("Sign in to view your notes."));
		expect(view.container.querySelector("a")?.getAttribute("href")).toBe("/sign-in");
		expect(view.container.querySelector("form")).toBeNull();
		expect(client.calls).toEqual([]);
	});
});

screens.it("shows typed command rejection after expiry without clearing the draft", [], function* ({ interact }) {
	yield* interact(async () => {
		const client = notesClient();
		const view = await render(<NotesScreen client={client} />);
		onTestFinished(view.unmount);
		await eventually(() => expect(client.calls).toEqual(["list"]));
		client.session.signedIn = false;
		const input = view.container.querySelector("input");
		if (!(input instanceof HTMLInputElement)) {
			throw new Error("Missing note input");
		}
		await act(() => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "Keep this draft");
			input.dispatchEvent(new Event("input", { bubbles: true }));
		});
		await act(() => view.container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
		await eventually(() => expect(view.container.querySelector("[role=alert]")?.textContent).toBe("Sign in to add a note."));
		expect(input.value).toBe("Keep this draft");
		expect(client.calls).toEqual(["list"]);
	});
});

screens.it("calls sign-out and shows a failed sign-out without claiming success", [], function* ({ interact }) {
	yield* interact(async () => {
		const client = notesClient();
		let calls = 0;
		const view = await render(
			<NotesScreen
				client={client}
				onSignOut={() => {
					calls += 1;
					return Promise.resolve("Could not sign out");
				}}
			/>,
		);
		onTestFinished(view.unmount);
		await act(async () => {
			[...view.container.querySelectorAll("button")].find((button) => button.textContent === "Sign out")?.click();
			await Promise.resolve();
		});
		expect(calls).toBe(1);
		expect(view.container.querySelector("[role=alert]")?.textContent).toBe("Could not sign out");
	});
});
