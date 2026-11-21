import { createMemoryHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import { SessionApp } from "@shivaedev/react/client/SessionApp.ts";
import { clientModules } from "#client/modules.ts";
import { routing } from "#client/routing.tsx";
import { appAuth } from "#test-support/appAuth.ts";
import { acquireScreen } from "#test-support/screenState.ts";
import { screens } from "#test-support/screens.ts";

export function defaultSessionScreen(signedIn: boolean) {
	return screens.trait(
		"screen",
		`${signedIn ? "alice" : "an anonymous visitor"} opens password reset with the generated module list`,
		function* (engine) {
			const view = yield* acquireScreen(engine);
			const auth = appAuth({ baseUrl: "http://modules.story.test" }).auth.actions;
			yield* Effect.promise(() =>
				view.render(
					<SessionApp
						{...routing}
						app={clientModules}
						auth={auth}
						history={createMemoryHistory({ initialEntries: ["/reset-password"] })}
						recheck={() => undefined}
						session={signedIn ? { user: { id: "alice" } } : null}
					/>,
				),
			);
		},
	);
}
