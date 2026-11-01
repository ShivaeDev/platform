import { createMemoryHistory, createRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { App } from "#client/App.tsx";
import { Home } from "#client/Home.tsx";
import { connectModules, type RouteContext } from "#client/Module.ts";
import { notesRegistration } from "#modules/notes/client/registration.tsx";
import { notesClient } from "#modules/notes/test-support/client.ts";
import { screens } from "#modules/notes/test-support/screens.ts";
import { appAuth } from "#test-support/appAuth.ts";
import { acquireScreen } from "#test-support/screenState.ts";

export function signInVisitor(initial: string, signedIn = false, moduleLink = false) {
	return screens.trait("screen", `a ${signedIn ? "signed-in" : "signed-out"} visitor opens ${initial}`, function* (engine) {
		const history = createMemoryHistory({ initialEntries: [initial] });
		engine.history = history;
		engine.client = yield* notesClient([{ id: 1, title: "Deep note", version: 0, wordCount: null }]);
		engine.client.session.signedIn = signedIn;
		const fixture = appAuth({
			baseUrl: "http://return.story.test",
			onSessionChange: (current) => {
				engine.client.session.signedIn = current;
			},
			signedIn,
		});
		engine.auth = fixture;
		engine.pending = () =>
			(engine.view?.registry.get(fixture.auth.session.atom).waiting ?? false)
			|| (engine.view !== undefined
				&& (engine.view.registry.get(fixture.auth.actions.submit).waiting || engine.view.registry.get(fixture.auth.actions.signOut).waiting));
		const view = yield* acquireScreen(engine, {
			onCaughtError: (error) => {
				engine.routeErrors.push(error);
			},
		});
		const resume = resumeModule(moduleLink);
		yield* Effect.promise(() =>
			view.render(<App auth={fixture.auth} connect={() => connectModules([resume, notesRegistration(engine.client)])} history={history} />),
		);
	});
}

function resumeModule(moduleLink: boolean) {
	return {
		api: {},
		routes: ({ getParentRoute }: RouteContext) => {
			const route = createRoute({
				component: () => <Home auth={getParentRoute().useRouteContext().auth} />,
				getParentRoute,
				path: "/resume",
				staticData: { signedIn: !moduleLink },
			});
			return [route];
		},
	};
}
