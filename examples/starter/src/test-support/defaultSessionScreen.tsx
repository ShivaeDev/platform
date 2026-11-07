import { createMemoryHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import { SessionApp } from "#client/SessionApp.tsx";
import { appAuth } from "#test-support/appAuth.ts";
import { acquireScreen } from "#test-support/screenState.ts";
import { screens } from "#test-support/screens.ts";

export function defaultSessionScreen(signedIn: boolean) {
	return screens.trait(
		"screen",
		`${signedIn ? "alice" : "an anonymous visitor"} opens password reset with the default module connection`,
		function* (engine) {
			const view = yield* acquireScreen(engine);
			const auth = appAuth({ baseUrl: "http://modules.story.test" }).auth.actions;
			yield* Effect.promise(() =>
				view.render(
					<SessionApp
						auth={auth}
						history={createMemoryHistory({ initialEntries: ["/reset-password"] })}
						recheck={() => undefined}
						userId={signedIn ? "alice" : undefined}
					/>,
				),
			);
		},
	);
}
