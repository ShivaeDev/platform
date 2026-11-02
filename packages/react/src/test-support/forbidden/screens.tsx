import { createMemoryHistory, createRootRoute, createRouter, RouterContextProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Forbidden, type ForbiddenProps } from "#adapters/Forbidden.ts";
import { screenKit } from "#test/screenKit.ts";

interface State {
	view?: Rendered;
}

export const forbiddenScreens = storyKit(
	screenKit(
		"no-access screen",
		(): State => ({}),
		(state, screen) => ({
			open: (props: ForbiddenProps) =>
				Effect.gen(function* () {
					const router = createRouter({ history: createMemoryHistory(), routeTree: createRootRoute() });
					state.view = yield* screen.open(
						<RouterContextProvider router={router}>
							<Forbidden {...props} />
						</RouterContextProvider>,
					);
				}),
			page: () =>
				Effect.sync(() => {
					const main = state.view?.container.querySelector("main");
					return {
						className: main?.className,
						description: main?.querySelector("p")?.textContent,
						heading: main?.querySelector("h1")?.textContent,
						link: { label: main?.querySelector("a")?.textContent, to: main?.querySelector("a")?.getAttribute("href") },
					};
				}),
		}),
	),
);
