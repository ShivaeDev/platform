import { createMemoryHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { clientModules } from "#client/modules.ts";
import { SessionApp } from "#client/SessionApp.tsx";
import { appAuth } from "./appAuth.ts";
import { acquireScreen } from "./screenState.ts";
import { screens } from "./screens.ts";
import { sessionModule } from "./sessionModule.tsx";

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
