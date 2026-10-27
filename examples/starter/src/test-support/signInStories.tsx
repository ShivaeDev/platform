import type { RouterHistory } from "@tanstack/react-router";
import { createMemoryHistory, createRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { eventually } from "@shivaedev/react/client/testing.ts";
import { permissionGuard } from "@shivaedev/react/permissionGuard.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { App } from "#client/App.tsx";
import { Home } from "#client/Home.tsx";
import { connectModules, type RouteContext } from "#client/Module.ts";
import { notesRegistration } from "#modules/notes/client/registration.tsx";
import { notesClient } from "#modules/notes/test-support/client.ts";
import { screenActions } from "#modules/notes/test-support/screenActions.ts";
import { screenObservations } from "#modules/notes/test-support/screenObservations.ts";
import { appAuth } from "#test-support/appAuth.ts";
import { acquireScreen, type ScreenSurface } from "#test-support/screenState.ts";

interface State extends ScreenSurface {
	caught: unknown[];
	client: ReturnType<typeof notesClient>;
	history: RouterHistory;
	requests: URL[];
}

export const signInApp = storyKit({
	clock: "live",
	create: (): State => ({
		caught: [],
		client: notesClient([{ id: 1, title: "Deep note", version: 0, wordCount: null }]),
		history: createMemoryHistory(),
		requests: [],
		view: undefined,
	}),
	inspect: ({ history, view }) => ({ href: history.location.href, text: view?.container.textContent }),
	name: "starter sign-in app",
	stages: ["screen"],
	verbs: (engine, story) => ({
		...screenActions(engine, story.tell),
		...screenObservations(engine),
		caught: () => engine.caught,
		expireRpc: () =>
			Effect.sync(() => {
				story.tell("the RPC server refuses this session");
				engine.client.session.signedIn = false;
			}),
		href: () => engine.history.location.href,
		observe: (check: () => void) => eventually(check),
		requests: () => engine.requests.map((url) => url.pathname),
	}),
});

export function visitor(initial: string, signedIn = false, moduleLink = false) {
	return signInApp.trait("screen", `a ${signedIn ? "signed-in" : "signed-out"} visitor opens ${initial}`, function* (engine) {
		engine.history.replace(initial);
		engine.client.session.signedIn = signedIn;
		const fixture = appAuth({
			baseUrl: "http://return.story.test",
			onSessionChange: (current) => {
				engine.client.session.signedIn = current;
			},
			signedIn,
		});
		engine.requests = fixture.requests;
		const view = yield* acquireScreen(engine, {
			onCaughtError: (error) => {
				engine.caught.push(error);
			},
		});
		const resume = resumeModule(moduleLink);
		yield* Effect.promise(() =>
			view.render(<App auth={fixture.auth} connect={() => connectModules([resume, notesRegistration(engine.client)])} history={engine.history} />),
		);
	});
}

function resumeModule(moduleLink: boolean) {
	return {
		api: {},
		routes: ({ root, auth, session }: RouteContext) => [
			createRoute({
				component: () => <Home auth={auth} />,
				getParentRoute: () => root,
				path: "/resume",
				...(moduleLink
					? {}
					: {
							beforeLoad: permissionGuard({ session, signIn: "/sign-in" }),
							staticData: { permission: { name: "resume", strength: "own" as const } },
						}),
			}),
		],
	};
}
