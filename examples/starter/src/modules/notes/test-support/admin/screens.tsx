import { createMemoryHistory } from "@tanstack/react-router";
import { Deferred, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { connectModules } from "#client/Module.ts";
import { SessionApp } from "#client/SessionApp.tsx";
import { adminRoutes } from "#modules/notes/client/adminRoutes.tsx";
import { screenAuth } from "#modules/notes/test-support/screenAuth.ts";
import type { ScreenSurface } from "#test-support/screenState.ts";
import { acquireScreen, screenView } from "#test-support/screenState.ts";
import { uiScreenVerbs } from "#test-support/uiScreenVerbs.ts";
import { failedJob } from "./backend.ts";
import { adminClient } from "./client.ts";

interface Screen extends ScreenSurface {
	client: ReturnType<typeof adminClient>;
	switchSession: (() => Promise<void>) | undefined;
}

export const adminScreens = storyKit({
	clock: "live",
	create: (): Screen => ({ client: adminClient(), switchSession: undefined, view: undefined }),
	inspect: (engine) => ({ activeStreams: engine.client.backend.state.activeStreams, text: engine.view?.container.textContent }),
	name: "admin screen",
	stages: ["backend", "screen"],
	verbs: (engine, story) => ({
		...uiScreenVerbs(engine, story.tell),
		activeAdminStreams: () => engine.client.backend.state.activeStreams,
		changeSession: () =>
			Effect.promise(() => {
				if (engine.switchSession === undefined) {
					throw new Error("Admin screen is not open");
				}
				return engine.switchSession();
			}),
		closeScreen: () => Effect.promise(screenView(engine).unmount),
		recoverHealth: () =>
			Effect.sync(() => {
				engine.client.backend.state.failed = false;
				engine.client.backend.state.jobs = [failedJob("recovered-job")];
			}),
		rejectRetry: () =>
			Effect.sync(() => {
				engine.client.backend.state.retryFails = true;
			}),
		releaseHealth: () =>
			Effect.sync(() => {
				const gate = engine.client.backend.state.gate;
				if (gate === undefined) {
					throw new Error("Health is not held");
				}
				Effect.runSync(Deferred.succeed(gate, undefined));
				engine.client.backend.state.gate = undefined;
			}),
	}),
});

export function adminScreen(path = "/admin/jobs") {
	return adminScreens.trait("screen", `the admin opens ${path}`, function* (engine) {
		const view = yield* acquireScreen(engine);
		const other = adminClient();
		const history = createMemoryHistory({ initialEntries: [path] });
		const auth = screenAuth();
		function connect({ id }: { readonly id: string }) {
			const client = id === "alice" ? engine.client : other;
			return connectModules([
				{ api: client.jobs, bindings: [client.jobs, client.statistics, client.users], routes: (context) => adminRoutes(client, context) },
			]);
		}
		function recheck() {
			return undefined;
		}
		function show(id: string) {
			return view.render(<SessionApp auth={auth} connect={connect} history={history} recheck={recheck} sessionId={id} />);
		}
		engine.switchSession = () => show("bob");
		yield* Effect.promise(() => show("alice"));
	});
}

export const failedJobs = adminScreens.trait("backend", "two original jobs have failed", (engine) => {
	engine.client.backend.state.jobs = [failedJob("first-job"), failedJob("second-job")];
});
export const retryRegistration = adminScreens.trait("backend", "the app registers the retry variant", (engine) => {
	engine.client = adminClient(true);
	engine.client.backend.state.jobs = [failedJob("retry-job")];
});
export const heldHealth = adminScreens.trait("backend", "the health request is held", (engine) => {
	engine.client.backend.state.gate = Effect.runSync(Deferred.make<void>());
});
export const unavailableHealth = adminScreens.trait("backend", "the health backend is unavailable", (engine) => {
	engine.client.backend.state.failed = true;
});
export const countedNotes = adminScreens.trait("backend", "the backend has counted notes across users", (engine) => {
	engine.client.backend.state.statistics = { notes: 7, pending: 2, words: 53 };
});
