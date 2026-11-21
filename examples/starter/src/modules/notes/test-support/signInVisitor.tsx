import { createMemoryHistory, createRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { clientModule } from "@shivaedev/react/client/module.ts";
import { App } from "#client/App.tsx";
import { Home } from "#client/Home.tsx";
import { notesClient } from "#modules/notes/test-support/client.ts";
import { fakeHostApp } from "#modules/notes/test-support/fakeHostApp.ts";
import { screens } from "#modules/notes/test-support/screens.ts";
import { appAuth } from "#test-support/appAuth.ts";
import { acquireScreen } from "#test-support/screenState.ts";

export function signInVisitor(initial: string, signedIn = false, moduleLink = false) {
	return screens.trait("screen", `${signedIn ? "signed-in alice" : "a signed-out visitor"} opens ${initial}`, function* (engine) {
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
			(engine.view !== undefined && fixture.sessionPending(engine.view.registry))
			|| (engine.view !== undefined
				&& (engine.view.registry.get(fixture.auth.actions.submit).waiting || engine.view.registry.get(fixture.auth.actions.signOut).waiting));
		const view = yield* acquireScreen(engine);
		const app = fakeHostApp(
			engine.client.options,
			(live) => {
				engine.live = live;
			},
			[resumeModule(moduleLink)],
		);
		yield* Effect.promise(() => view.render(<App app={app} auth={fixture.auth} history={history} />));
	});
}

function resumeModule(moduleLink: boolean) {
	return clientModule({}, () => ({
		routes: (root) => [
			createRoute({
				component: () => <Home />,
				getParentRoute: () => root,
				path: "/resume",
				staticData: { signedIn: !moduleLink },
			}),
		],
	}));
}
