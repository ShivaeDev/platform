import { createMemoryHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { clientModules } from "#client/modules.ts";
import { SessionApp } from "#client/SessionApp.tsx";
import { appAuth } from "#test-support/appAuth.ts";
import { acquireScreen } from "#test-support/screenState.ts";
import { screens } from "#test-support/screens.ts";
import { sessionModule } from "#test-support/sessionModule.tsx";

export function sessionModulesScreen(name: "notes" | "tasks", signedIn: boolean) {
	return screens.trait("screen", `${signedIn ? "alice" : "a signed-out visitor"} opens the ${name} module`, function* (engine) {
		const view = yield* acquireScreen(engine);
		engine.pending = () => view.container.querySelector("output") === null || view.container.querySelector('[data-pending="true"]') !== null;
		const auth = appAuth({ baseUrl: "http://modules.story.test" }).auth.actions;
		yield* Effect.promise(() =>
			view.render(
				<SessionApp
					auth={auth}
					connect={(session, registry) =>
						clientModules(session, [sessionModule("notes", session.id), sessionModule("tasks", session.id)]).pipe(
							Effect.provideService(AtomRegistry.AtomRegistry, registry),
						)
					}
					history={createMemoryHistory({ initialEntries: [`/${name}`] })}
					recheck={() => undefined}
					userId={signedIn ? "alice" : undefined}
				/>,
			),
		);
	});
}
