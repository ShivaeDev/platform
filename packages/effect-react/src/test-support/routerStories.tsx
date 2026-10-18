import { RouterProvider } from "@tanstack/react-router";
import { Deferred, Effect } from "effect";
import type { Rendered } from "#testing.ts";
import { routerApp } from "./routerApp.ts";
import { type NoteMissing, routerClient } from "./routerClient.ts";
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
		missing: (failure: NoteMissing) =>
			screen.act(`note ${failure.id} is missing`, () => Effect.runPromise(Deferred.fail(state.client.gate(failure.id), failure))),
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
			screen.act(`note ${id} responds: ${title}`, () => Effect.runPromise(Deferred.succeed(state.client.gate(id), { id, title }))),
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
