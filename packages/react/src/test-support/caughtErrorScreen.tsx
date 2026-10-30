import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import type { RootOptions } from "react-dom/client";
import { vi } from "vitest";
import { expectNoReactWarnings, type Rendered, render } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
const warnings = expectNoReactWarnings();

export class RouteFailure extends Error {}

function failureRouter(failure: Error | null, warning: boolean) {
	const root = createRootRoute({ component: Outlet });
	const route = createRoute({
		component: () => <h1>Route ready</h1>,
		errorComponent: ({ error }) => (
			<section>
				<p role="alert">{error instanceof Error ? error.message : String(error)}</p>
				{warning ? ["first", "second"].map((text) => <span key="duplicate">{text}</span>) : null}
			</section>
		),
		getParentRoute: () => root,
		loader: () => {
			if (failure) {
				throw failure;
			}
		},
		path: "/failure",
	});
	return createRouter({ history: createMemoryHistory({ initialEntries: ["/failure"] }), routeTree: root.addChildren([route]) });
}

export const caughtErrorScreen = storyKit({
	clock: "live",
	create: (): { roots: Rendered[] } => ({ roots: [] }),
	inspect: ({ roots }) => roots.map(({ container }) => container.innerHTML),
	name: "caught error screen",
	stages: ["screen"],
	verbs: (state, story) => ({
		alert: () => Effect.sync(() => state.roots.at(-1)?.container.querySelector('[role="alert"]')?.textContent ?? "no alert"),
		expectCaughtError: warnings.expectCaughtError,
		heading: () => Effect.sync(() => state.roots.at(-1)?.container.querySelector("h1")?.textContent ?? "no heading"),
		logError: (message: string) => Effect.sync(() => vi.mocked(console.error)(message)),
		openRoute: (failure: Error | null, options?: RootOptions, warning = false) =>
			Effect.acquireRelease(
				Effect.promise(async () => {
					story.tell(failure === null ? "open a route that loads" : `open a route whose loader throws ${failure.name}: ${failure.message}`);
					const router = failureRouter(failure, warning);
					await router.load();
					const view = await render(<RouterProvider router={router} />, options);
					state.roots.push(view);
					return view;
				}),
				(view) => Effect.promise(view.unmount),
			).pipe(Effect.asVoid),
	}),
});
