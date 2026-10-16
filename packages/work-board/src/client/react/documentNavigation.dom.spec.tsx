import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Deferred, Effect } from "effect";
import { act } from "react";
import { expect, type MockInstance, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import { type BoardTestApi, renderBoard } from "#test/react.tsx";
import { renderRouter } from "#test/renderRouter.tsx";
import { boardRouter } from "./boardRouter.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
const files = {
	"home.md": "# Home\n\n## Plans\n",
	"notes/first.md": "# First\n\n<details><summary>Evidence</summary>Retained evidence</details>\n",
	"notes/next.md": "# Next\n",
};

it.live.each([false, true])("clears the old document while loading and handles back before the read completes (back: %s)", function* (back) {
	const gate = yield* Deferred.make<void>();
	let pending: Promise<void> | undefined;
	let started = false;
	const view = yield* Effect.promise(() =>
		renderRouter(files, "/notes/first.md", {
			beforeRead: (kind, url) =>
				kind === "document" && url === "/notes/next.md"
					? Effect.sync(() => {
							started = true;
						}).pipe(Effect.andThen(Deferred.await(gate)))
					: Effect.void,
			home: "home.md",
		}),
	);
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("#doc h1")?.textContent).toBe("First")));
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector<HTMLElement>("#doc")?.dataset.route).toBe("/notes/first.md")));
		const main = view.container.querySelector("main");
		view.container.querySelector<HTMLDetailsElement>("article details")?.setAttribute("open", "");
		yield* Effect.promise(() =>
			act(async () => {
				pending = view.router.navigate({ to: "/notes/next.md" });
				await Promise.resolve();
			}),
		);
		yield* Effect.promise(() => eventually(() => expect(started).toBe(true)));
		expect(view.router.state.location.pathname).toBe("/notes/next.md");
		expect(view.container.querySelector("#doc h1")).toBeNull();
		expect(view.container.querySelector("#doc [role=status]")?.textContent).toBe("Opening document…");
		if (back) {
			yield* Effect.promise(() =>
				act(async () => {
					view.router.history.back();
					await Promise.resolve();
				}),
			);
			yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("#doc h1")?.textContent).toBe("First")));
		}
		yield* Effect.promise(() =>
			act(async () => {
				Effect.runSync(Deferred.succeed(gate, undefined));
				await pending;
			}),
		);
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("#doc h1")?.textContent).toBe(back ? "First" : "Next")));
		expect(view.container.querySelector("main")).toBe(main);
		if (back) {
			yield* Effect.promise(() => eventually(() => expect(view.container.querySelector<HTMLDetailsElement>("article details")?.open).toBe(true)));
		}
	} finally {
		yield* Effect.promise(() =>
			act(async () => {
				Effect.runSync(Deferred.succeed(gate, undefined));
				await pending;
			}),
		);
		yield* Effect.promise(() => view.unmount());
	}
});

it.live("shares one navigation query across the shell, document loaders and back navigation", function* () {
	let router: ReturnType<typeof boardRouter> | undefined;
	let navigation: MockInstance<BoardTestApi["navigation"]["query"]> | undefined;
	const view = yield* Effect.promise(() =>
		renderBoard(files, (api, registry) => {
			navigation = vi.spyOn(api.navigation, "query");
			router = boardRouter({ api, registry });
			router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: ["/notes/first.md"] }) });
			return <RouterProvider router={router} />;
		}),
	);
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("#doc h1")?.textContent).toBe("First")));
		yield* Effect.promise(() =>
			act(async () => {
				await router?.navigate({ to: "/notes/next.md" });
			}),
		);
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("#doc h1")?.textContent).toBe("Next")));
		yield* Effect.promise(() =>
			act(async () => {
				router?.history.back();
				await Promise.resolve();
			}),
		);
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("#doc h1")?.textContent).toBe("First")));
		expect(navigation?.mock.calls.length).toBeGreaterThan(1);
		expect(new Set(navigation?.mock.results.map((result) => result.value)).size).toBe(1);
	} finally {
		yield* Effect.promise(() => view.unmount());
		navigation?.mockRestore();
	}
});
