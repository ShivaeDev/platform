import { RouterProvider } from "@tanstack/react-router";
import { Deferred, Effect } from "effect";
import { expect, vi } from "vitest";
import type { Rendered } from "#testing.ts";
import { routerApp } from "./routerApp.ts";
import { NoteMissing, routerClient } from "./routerClient.ts";
import { screenKit } from "./screenKit.ts";

interface State {
	client: ReturnType<typeof routerClient>;
	root?: Rendered;
	router?: ReturnType<typeof routerApp>;
}
function current(state: State) {
	if (!(state.root && state.router)) {
		throw new Error("No router screen");
	}
	return { ...state, root: state.root, router: state.router };
}
export const routes = screenKit(
	"route screen",
	(): State => ({ client: routerClient() }),
	(state, screen) => ({
		missing: (id: string) => {
			const failure = new NoteMissing({ id });

			return screen
				.act(`note ${id} is missing`, () => Effect.runPromise(Deferred.fail(state.client.gate(id), failure)))
				.pipe(
					Effect.andThen(
						screen.observe("the route renders its declared failure", () =>
							expect(current(state).root.container.querySelector("[role=alert]")?.textContent).toBe(`NoteMissing:${id}`),
						),
					),
					Effect.tap(() => Effect.sync(() => verifyRouteError(failure))),
					Effect.as(failure),
				);
		},
		navigate: () =>
			screen.act("navigate to the second note", () => {
				const link = current(state).root.container.querySelector<HTMLAnchorElement>("a");
				if (!link) {
					throw new Error("No second note link");
				}
				link.click();
			}),
		route: () => current(state),
		succeed: (id: string, title: string) =>
			screen
				.act(`note ${id} responds: ${title}`, () => Effect.runPromise(Deferred.succeed(state.client.gate(id), { id, title })))
				.pipe(
					Effect.andThen(
						screen.observe(`heading is ${title}`, () => expect(current(state).root.container.querySelector("h1")?.textContent).toBe(title)),
					),
				),
		waitForPending: () => screen.act("the pending route threshold passes", () => new Promise<void>((resolve) => setTimeout(resolve, 1100))),
	}),
);
export function noteRoute(initial?: string) {
	return routes.trait("screen", `the notes router at ${initial ?? "/notes/first"}`, function* ({ screen, state }) {
		const root = yield* screen.open();
		state.root = root;
		const router = routerApp(root.registry, state.client, initial);
		state.router = router;
		yield* Effect.promise(() => root.render(<RouterProvider router={router} />));
	});
}

function verifyRouteError(failure: NoteMissing) {
	expect(vi.mocked(console.error).mock.calls).toEqual([
		[
			expect.any(String),
			failure,
			"The above error occurred in the <MatchInnerImpl> component.",
			"React will try to recreate this component tree from scratch using the error boundary you provided, CatchBoundary.",
		],
	]);
	vi.mocked(console.error).mockClear();
}
