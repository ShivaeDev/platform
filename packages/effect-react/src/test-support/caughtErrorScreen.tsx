import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import type { RootOptions } from "react-dom/client";
import { vi } from "vitest";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { expectNoReactWarnings, type Rendered, render } from "#client/testing.ts";

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
		expectCaughtError: warnings.expectCaughtError,
		logError: (message: string) => Effect.sync(() => vi.mocked(console.error)(message)),
		openRoute: (failure: Error | null, options?: RootOptions, warning = false) =>
			Effect.acquireRelease(
				Effect.promise(async () => {
					story.tell("open the route screen");
					const router = failureRouter(failure, warning);
					await router.load();
					const view = await render(<RouterProvider router={router} />, options);
					state.roots.push(view);
					return view;
				}),
				(view) => Effect.promise(view.unmount),
			),
	}),
});
