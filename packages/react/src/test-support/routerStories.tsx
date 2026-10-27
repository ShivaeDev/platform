import { RouterProvider } from "@tanstack/react-router";
import { Deferred, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Rendered } from "#client/testing.ts";
import { routerApp } from "./routerApp.ts";
import { type NoteMissing, type NotFound, routerClient } from "./routerClient.ts";
import { clickButton, screenWarnings, typeInput } from "./Screen.ts";
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
export const routes = storyKit(
	screenKit(
		"route screen",
		(): State => ({ client: routerClient() }),
		(state, screen) => ({
			missing: (failure: NoteMissing | NotFound) =>
				screen.act(`note ${failure.id} is missing`, () => Effect.runPromise(Deferred.fail(state.client.gate(failure.id), failure))),
			navigate: () =>
				screen.act("navigate to the second note", () => {
					const link = current(state).root.container.querySelector<HTMLAnchorElement>("a");
					if (!link) {
						throw new Error("No second note link");
					}
					link.click();
				}),
			nextResponse: (id: string) => {
				screen.tell(`the next response for ${id} waits`);
				state.client.next(id);
			},
			retry: () => screen.act("retry the loader", () => clickButton(current(state).root.container, "Retry")),
			route: () => current(state),
			search: (page: number) =>
				screen.act(`change page to ${page}`, () => {
					void current(state).router.navigate({ params: { id: "first" }, search: { page }, to: "/notes/$id" });
				}),
			succeed: (id: string, title: string, page = 1) =>
				screen.act(`note ${id} responds: ${title}`, () => Effect.runPromise(Deferred.succeed(state.client.gate(id, page), { id, title }))),
			typeShell: (value: string) => screen.act(`type in the shell: ${value}`, () => typeInput(current(state).root.container, "shell", value)),
		}),
	),
);
export function noteRoute(initial?: string, expectedFailure?: NoteMissing) {
	return routes.trait("screen", `the notes router at ${initial ?? "/notes/first"}`, function* ({ screen, state }) {
		const root = yield* screen.open(
			null,
			expectedFailure ? { onCaughtError: screenWarnings.expectCaughtError((error) => error === expectedFailure) } : undefined,
		);
		state.root = root;
		const router = routerApp(root.registry, state.client, initial);
		state.router = router;
		yield* Effect.promise(() => root.render(<RouterProvider router={router} />));
	});
}
