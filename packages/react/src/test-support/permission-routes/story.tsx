import { Effect, Predicate } from "effect";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { clickButton, type Screen, screenWarnings } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { permissionApp } from "./app.tsx";
import type { Role } from "./feature.ts";
import { type Host, openHost } from "./host.ts";
import { PermissionApp } from "./view.tsx";

interface State {
	app?: ReturnType<typeof permissionApp>;
	host?: Host;
	role?: Role | undefined;
	serverRole?: Role | undefined;
	view?: Rendered;
}

function current(state: State) {
	if (!(state.host && state.view && state.app)) {
		throw new Error("No permission route screen");
	}
	return { ...state.app, host: state.host, view: state.view };
}

function heading(state: State) {
	return current(state).view.container.querySelector("h1")?.textContent ?? "none";
}

function settle(state: State, screen: Screen) {
	return Effect.suspend(() => {
		const { router, view } = current(state);
		return settleScreen(
			view.container,
			() =>
				["none", "Loading query"].includes(heading(state))
				|| (view.container.querySelector("[data-boundary]") === null && (router.state.status === "pending" || router.state.isLoading)),
			screen.tell,
		);
	});
}

function navigated(state: State) {
	const { router } = current(state);
	const from = router.state.location.href;
	return new Promise<void>((resolve) => {
		const unsubscribe = router.subscribe("onResolved", (event) => {
			if (event.toLocation.href !== from) {
				unsubscribe();
				resolve();
			}
		});
	});
}

function expectedFailure(state: State, path: string) {
	const notes = path.startsWith("/notes/");
	if (path === "/notes/offline") {
		return "ServiceUnavailable";
	}
	return (notes && state.role === "guest") || ((path === "/query" || notes) && state.serverRole === "guest") ? "Forbidden" : undefined;
}

function routeVerbs(state: State, screen: Screen) {
	function clickAndNavigate(label: string, line: string) {
		return Effect.gen(function* () {
			const navigation = navigated(state);
			yield* screen.act(line, () => clickButton(current(state).view.container, label));
			yield* screen.act("the navigation resolves", () => navigation);
			yield* settle(state, screen);
		});
	}
	return {
		signIn: () => clickAndNavigate("Sign in", "sign in as a reader"),
		signOut: () => clickAndNavigate("Sign out", "sign out explicitly"),
		visit: (path: string) =>
			Effect.gen(function* () {
				const host = state.host;
				if (!host) {
					return yield* Effect.die(new Error("No permission host"));
				}
				const failure = expectedFailure(state, path);
				const view = yield* screen.open(
					null,
					failure ? { onCaughtError: screenWarnings.expectCaughtError((error) => Predicate.isTagged(error, failure)) } : undefined,
				);
				const session = state.role === undefined ? undefined : yield* host.payload(state.role);
				const app = permissionApp(host, view.registry, session, path);
				state.view = view;
				state.app = app;
				yield* screen.act(`visit ${path}`, () => view.render(<PermissionApp app={app} />));
				yield* settle(state, screen);
			}),
	};
}

export const permissionScreens = storyKit(
	screenKit(
		"permission route screen",
		(): State => ({}),
		(state, screen) => ({
			...routeVerbs(state, screen),
			buttons: () => Effect.sync(() => [...current(state).view.container.querySelectorAll("button")].map((button) => button.textContent)),
			heading: () => Effect.sync(() => heading(state)),
			location: () => Effect.sync(() => current(state).router.state.location.href),
			path: () => Effect.sync(() => current(state).router.state.location.pathname),
			requests: () => Effect.sync(() => [...current(state).host.requests]),
			returnTo: () => Effect.sync(() => new URLSearchParams(current(state).router.state.location.searchStr).get("returnTo") ?? "none"),
		}),
	),
);

function* openApp(state: State, role: Role | undefined, serverRole: Role | undefined) {
	state.role = role;
	state.serverRole = serverRole;
	state.host = yield* openHost(serverRole);
}

export function visitor(role: Role | undefined, serverRole = role) {
	const who = role ? `a ${role}` : "a signed-out visitor";
	const server = serverRole === role ? "" : ` whose server session is a ${serverRole}`;
	return permissionScreens.trait("screen", `${who}${server} with the note routes served over HTTP`, ({ state }) => openApp(state, role, serverRole));
}

export function visited(role: Role | undefined, path: string) {
	return permissionScreens.trait("screen", `${role ? `a ${role}` : "a signed-out visitor"} who visited ${path}`, function* ({ screen, state }) {
		yield* openApp(state, role, role);
		yield* routeVerbs(state, screen).visit(path);
	});
}
