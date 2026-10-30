import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { SignOutRegistryContext } from "#internal/SignOutRegistryContext.ts";
import { clickButton } from "./Screen.ts";
import { SignOutControls } from "./SignOutControls.tsx";
import { screenKit } from "./screenKit.ts";

interface State {
	readonly destinations: string[];
	owner?: { readonly action: Atom.AtomResultFn<void, void>; readonly registry: AtomRegistry.AtomRegistry };
	readonly requests: string[];
	readonly response: PromiseWithResolvers<void>;
	view?: Rendered;
}
function view(state: State) {
	if (!state.view) {
		throw new Error("No sign-out screen");
	}
	return state.view;
}
export const signOuts = storyKit(
	screenKit(
		"sign-out screen",
		(): State => ({ destinations: [], requests: [], response: Promise.withResolvers<void>() }),
		(state, screen) => ({
			click: () => screen.act("click Sign out", () => clickButton(view(state).container, "Sign out")),
			complete: () => screen.act("the sign-out request succeeds", () => state.response.resolve()),
			destinations: () => state.destinations,
			phase: () => view(state).container.querySelector("output")?.textContent,
			requests: () => state.requests,
			startFromAuthOwner: () =>
				screen.act("the auth owner dispatches sign-out", () => {
					if (!state.owner) {
						throw new Error("No sign-out owner");
					}
					state.owner.registry.set(state.owner.action, undefined);
				}),
			unmount: () => screen.act("unmount the sign-out component", () => view(state).render(null)),
		}),
	),
);
export function pendingSignOut() {
	return signOuts.trait("screen", "a sign-out request waiting for the server", function* ({ screen, state }) {
		const registry = yield* Effect.acquireRelease(
			Effect.sync(() => AtomRegistry.make()),
			(owner) => Effect.sync(() => owner.dispose()),
		);
		const action = Atom.fn(() =>
			Effect.gen(function* () {
				state.requests.push("sign-out");
				yield* Effect.promise(() => state.response.promise);
			}),
		);

		state.owner = { action, registry };
		const root = createRootRoute({ component: Outlet });
		const home = createRoute({ component: () => <SignOutControls action={action} />, getParentRoute: () => root, path: "/" });
		const login = createRoute({ component: () => <h1>Sign in</h1>, getParentRoute: () => root, path: "/sign-in" });
		const history = createMemoryHistory({ initialEntries: ["/"] });
		yield* Effect.acquireRelease(
			Effect.sync(() =>
				history.subscribe(({ location }) => {
					if (location.pathname === "/sign-in") {
						state.destinations.push(location.pathname);
					}
				}),
			),
			(unsubscribe) => Effect.sync(unsubscribe),
		);
		const router = createRouter({ history, routeTree: root.addChildren([home, login]) });
		state.view = yield* screen.open();
		yield* screen.act("open the signed-in route", () =>
			view(state).render(
				<SignOutRegistryContext.Provider value={registry}>
					<RouterProvider router={router} />
				</SignOutRegistryContext.Provider>,
			),
		);
	});
}
