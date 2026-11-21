import { createMemoryHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import { clientApp } from "@shivaedev/react/client/app.ts";
import { App } from "#client/App.tsx";
import { accountModule } from "#client/accountModule.tsx";
import { appAuth } from "#test-support/appAuth.ts";
import { acquireScreen } from "#test-support/screenState.ts";
import { screens } from "#test-support/screens.ts";

export const homeScreen = screens.trait("screen", "the app has no feature modules", function* (engine) {
	const fixture = appAuth({ baseUrl: "http://foundation.story.test" });
	const view = yield* acquireScreen(engine);
	engine.pending = () =>
		(engine.view !== undefined && fixture.sessionPending(engine.view.registry))
		|| (engine.view !== undefined
			&& (engine.view.registry.get(fixture.auth.actions.submit).waiting || engine.view.registry.get(fixture.auth.actions.signOut).waiting));
	yield* Effect.promise(() =>
		view.render(<App app={clientApp([accountModule])} auth={fixture.auth} history={createMemoryHistory({ initialEntries: ["/"] })} />),
	);
});
