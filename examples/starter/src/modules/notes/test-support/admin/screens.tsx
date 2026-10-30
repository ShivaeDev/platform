import { createMemoryHistory } from "@tanstack/react-router";
import { Deferred, Effect, Predicate } from "effect";
import { act } from "react";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { AppAccess } from "#AppAccess.ts";
import { JobsView } from "#client/admin/JobsView.tsx";
import { foundationRegistration } from "#client/foundationRegistration.ts";
import { connectModules } from "#client/Module.ts";
import { SessionApp } from "#client/SessionApp.tsx";
import { Admin } from "#modules/notes/admin.ts";
import { adminRoutes } from "#modules/notes/client/adminRoutes.tsx";
import { screenAuth } from "#modules/notes/test-support/screenAuth.ts";
import { foundation } from "#modules.ts";
import type { ScreenSurface } from "#test-support/screenState.ts";
import { acquireScreen, screenView } from "#test-support/screenState.ts";
import { uiScreenVerbs } from "#test-support/uiScreenVerbs.ts";
import { failedJob } from "./backend.ts";
import { adminClient } from "./client.ts";

const { UsersPage } = foundation;

const warnings = expectNoReactWarnings();

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
			Effect.promise(async () => {
				const gate = engine.client.backend.state.gate;
				if (gate === undefined) {
					throw new Error("Health is not held");
				}
				await act(() => {
					Effect.runSync(Deferred.succeed(gate, undefined));
					engine.client.backend.state.gate = undefined;
				});
			}),
	}),
});

export function adminScreen(path = "/admin/jobs", role: typeof AppAccess.Role.Type = "admin") {
	return adminScreens.trait("screen", `the admin opens ${path}`, function* (engine) {
		const access = yield* AppAccess.resolve(role);
		const view = yield* acquireScreen(
			engine,
			AppAccess.hasPermission(role, UsersPage.route.permission)
				? undefined
				: { onCaughtError: warnings.expectCaughtError((error) => Predicate.isTagged(error, "Forbidden")) },
		);
		const other = adminClient();
		const history = createMemoryHistory({ initialEntries: [path] });
		const auth = screenAuth();
		function connect({ id }: { readonly id: string }) {
			const client = id === "alice" ? engine.client : other;
			return connectModules([
				foundationRegistration(client),
				{
					admin: Admin,
					api: client.statistics,
					bindings: [client.jobs, client.statistics, client.users],
					routes: (context) => adminRoutes(client, { adminPages: context.adminPages, getParentRoute: () => context.root, session: context.session }),
				},
			]);
		}
		function recheck() {
			return undefined;
		}
		function show(id: string) {
			return view.render(
				<SessionApp
					auth={auth}
					connect={connect}
					history={history}
					recheck={recheck}
					session={{ user: { permissions: access.permissions } }}
					sessionId={id}
				/>,
			);
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

export const emptyJobsScreen = adminScreens.trait("screen", "the Jobs view has no registered queues", function* (engine) {
	const view = yield* acquireScreen(engine);
	yield* Effect.promise(() => view.render(<JobsView api={engine.client.jobs} queues={[]} />));
});
