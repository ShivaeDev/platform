import { Effect, Predicate } from "effect";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { clickButton, screenWarnings } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";
import { permissionApp } from "./app.tsx";
import type { Role } from "./feature.ts";
import { type Host, openHost } from "./host.ts";
import { PermissionApp } from "./view.tsx";

interface State {
	app?: ReturnType<typeof permissionApp>;
	host?: Host;
	view?: Rendered;
}
function current(state: State) {
	if (!(state.host && state.view && state.app)) {
		throw new Error("No permission route screen");
	}
	return { ...state.app, host: state.host, view: state.view };
}
export const permissionScreens = storyKit(
	screenKit(
		"permission route screen",
		(): State => ({}),
		(state, screen) => ({
			route: () => current(state),
			signIn: () => screen.act("sign in as a reader", () => clickButton(current(state).view.container, "Sign in")),
			signOut: () => screen.act("explicitly sign out", () => clickButton(current(state).view.container, "Sign out")),
		}),
	),
);

export function visitor(role: Role | undefined, initial = "/notes/first", serverRole = role) {
	return permissionScreens.trait("screen", `a ${role ?? "signed-out"} visitor at ${initial}`, function* ({ state, screen }) {
		const host = yield* openHost(serverRole);
		state.host = host;
		const session = role === undefined ? undefined : yield* host.payload(role);
		const denied =
			(initial.startsWith("/notes/") && role !== undefined && role !== "reader")
			|| ((initial === "/query" || initial.startsWith("/notes/")) && serverRole !== undefined && serverRole !== "reader");
		const unavailable = initial === "/notes/offline";
		const view = yield* screen.open(
			null,
			denied || unavailable
				? {
						onCaughtError: screenWarnings.expectCaughtError((error) => Predicate.isTagged(error, unavailable ? "ServiceUnavailable" : "Forbidden")),
					}
				: undefined,
		);
		state.view = view;
		const app = permissionApp(host, view.registry, session, initial);
		state.app = app;
		yield* Effect.promise(() => view.render(<PermissionApp app={app} />));
	});
}
