import { RouterProvider } from "@tanstack/react-router";
import { Deferred, Effect } from "effect";
import { act } from "react";
import { beforeEach, expect, it, onTestFinished, vi } from "vitest";
import { eventually, render } from "#client/testing.ts";
import { routerApp } from "#test/routerApp.ts";
import { NoteMissing, routerClient } from "#test/routerClient.ts";

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

async function mount(initial?: string) {
	const client = routerClient();
	const view = await render(null);
	onTestFinished(view.unmount);
	const router = routerApp(view.registry, client, initial);
	await view.render(<RouterProvider router={router} />);
	async function succeed(id: string, title: string) {
		await act(async () => {
			await Effect.runPromise(Deferred.succeed(client.gate(id), { id, title }));
		});
		await eventually(() => expect(view.container.querySelector("h1")?.textContent).toBe(title));
	}
	return { ...view, client, router, succeed };
}

it("a route loader and rendered contract query use the same native execution and runtime", async () => {
	const view = await mount();
	await eventually(() => expect(view.client.calls).toEqual(["first"]));
	await view.succeed("first", "First note");
	expect(view.container.querySelector("[data-query]")?.textContent).toBe("First note");
	expect(view.client.calls).toEqual(["first"]);
	expect(view.client.builds()).toBe(1);
});

it("a declared RPC failure reaches the route error component as its tagged error", async () => {
	const view = await mount("/notes/missing");
	await eventually(() => expect(view.client.calls).toEqual(["missing"]));
	const failure = new NoteMissing({ id: "missing" });
	expectedErrors = [
		[
			expect.any(String),
			failure,
			"The above error occurred in the <MatchInnerImpl> component.",
			"React will try to recreate this component tree from scratch using the error boundary you provided, CatchBoundary.",
		],
	];
	await act(async () => {
		await Effect.runPromise(Deferred.fail(view.client.gate("missing"), failure));
	});
	await eventually(() => expect(view.container.querySelector("[role=alert]")?.textContent).toBe("NoteMissing:missing"));
	expect(view.router.state.matches.at(-1)?.error).toBe(failure);
});

it("navigation shows pending state while keeping the previous contract data until the new query settles", async () => {
	const view = await mount();
	await view.succeed("first", "First note");
	let navigation: Promise<void> | undefined;
	await act(() => {
		navigation = view.router.navigate({ params: { id: "second" }, to: "/notes/$id" });
	});
	await eventually(() => expect(view.client.calls).toEqual(["first", "second"]));
	await act(() => new Promise<void>((resolve) => setTimeout(resolve, 1100)));
	expect(view.container.querySelector("[data-pending]")?.textContent).toBe("true");
	expect(view.container.querySelector("h1")?.textContent).toBe("First note");
	expect(view.container.querySelector("[data-query]")?.textContent).toBe("First note");
	await view.succeed("second", "Second note");
	await act(async () => navigation);
	expect(view.container.querySelector("[data-pending]")?.textContent).toBe("false");
	expect(view.container.querySelector("[data-query]")?.textContent).toBe("Second note");
	expect(view.client.builds()).toBe(1);
});
