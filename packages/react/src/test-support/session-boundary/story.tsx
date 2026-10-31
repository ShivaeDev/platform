import { createBrowserHistory, createMemoryHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { clickButton, type Screen } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { BoundaryApp, type BoundaryScreen } from "./App.tsx";

interface State {
	app?: BoundaryScreen;
	view?: Rendered;
}
function opened(state: State) {
	if (state.view === undefined || state.app === undefined) {
		throw new Error("No boundary screen is open");
	}
	return { app: state.app, view: state.view };
}
function settle(state: State, screen: Screen) {
	const { app, view } = opened(state);
	return settleScreen(view.container, () => app.pending(), screen.tell);
}
function verbs(state: State, screen: Screen) {
	function click(label: string) {
		return screen.act(`click ${label}`, () => clickButton(opened(state).view.container, label)).pipe(Effect.andThen(settle(state, screen)));
	}
	return {
		changePassword: () => click("Change password"),
		count: () => click("Count"),
		displayedCount: () => Effect.sync(() => opened(state).view.container.querySelector("output")?.textContent ?? "no count"),
		heading: () => Effect.sync(() => opened(state).view.container.querySelector("h1")?.textContent),
		href: () => Effect.sync(() => opened(state).app.history.location.href),
		signIn: () => click("Sign in"),
	};
}
export const sessionBoundaryScreens = storyKit(screenKit("session routing boundary", (): State => ({}), verbs));

export function visitorAt(
	path: string,
	options: { readonly signedIn?: boolean; readonly sessionIdentity?: boolean; readonly browserHistory?: boolean } = {},
) {
	return sessionBoundaryScreens.trait(
		"screen",
		`visitor opens ${path}${options.signedIn ? " already signed in" : ""}`,
		function* ({ state, screen }) {
			if (options.browserHistory) {
				const previous = window.location.href;
				yield* Effect.addFinalizer(() => Effect.sync(() => window.history.replaceState(null, "", previous)));
				window.history.replaceState(null, "", path);
			}
			state.app = {
				browserHistory: options.browserHistory ?? false,
				history: options.browserHistory ? createBrowserHistory() : createMemoryHistory({ initialEntries: [path] }),
				pending: () => false,
				sessionIdentity: options.sessionIdentity ?? false,
				signedIn: options.signedIn ?? false,
			};
			state.view = yield* screen.open(<BoundaryApp screen={state.app} />);
			yield* settle(state, screen);
		},
	);
}
