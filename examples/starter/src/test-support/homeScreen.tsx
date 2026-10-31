import { createMemoryHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import { App } from "#client/App.tsx";
import { connectModules } from "#client/Module.ts";
import { acquireScreen } from "#test-support/screenState.ts";
import { appAuth } from "./appAuth.ts";
import { screens } from "./screens.ts";

export const homeScreen = screens.trait("screen", "the app has no feature modules", function* (engine) {
	const fixture = appAuth({ baseUrl: "http://foundation.story.test" });
	const view = yield* acquireScreen(engine);
	engine.pending = () =>
		(fixture.auth.client.$store.atoms.session?.get().isPending ?? false)
		|| (engine.view !== undefined
			&& (engine.view.registry.get(fixture.auth.actions.submit).waiting || engine.view.registry.get(fixture.auth.actions.signOut).waiting));
	yield* Effect.promise(() =>
		view.render(<App auth={fixture.auth} connect={() => connectModules([])} history={createMemoryHistory({ initialEntries: ["/"] })} />),
	);
});
