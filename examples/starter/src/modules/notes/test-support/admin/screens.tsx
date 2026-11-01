import { createMemoryHistory } from "@tanstack/react-router";
import { Effect, Predicate } from "effect";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { AppAccess } from "#AppAccess.ts";
import { foundation } from "#admin/modules.ts";
import { foundationRegistration } from "#client/admin/foundationRegistration.tsx";
import { connectModules } from "#client/Module.ts";
import { SessionApp } from "#client/SessionApp.tsx";
import { adminRegistration } from "#modules/notes/client/admin/registration.tsx";
import { screenAuth } from "#modules/notes/test-support/screenAuth.ts";
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
	verbs: (engine, story) => {
		const ui = uiScreenVerbs(engine, story.tell);
		function container() {
			return screenView(engine).container;
		}
		return {
			changesSession: () =>
				Effect.promise(() => {
					story.tell("the signed-in session changes to bob");
					if (engine.switchSession === undefined) {
						throw new Error("Admin screen is not open");
					}
					return engine.switchSession();
				}),
			failedJobs: () => Effect.sync(() => [...container().querySelectorAll("tbody tr button")].map((button) => button.textContent)),
			heading: ui.heading,
			liveAdminStreams: () => Effect.sync(() => (engine.client.backend.state.activeStreams > 0 ? "open" : "none open")),
			noteStatistics: () =>
				Effect.sync(() =>
					Object.fromEntries([...container().querySelectorAll("dl dt")].map((term) => [term.textContent, term.nextElementSibling?.textContent])),
				),
			offers: (label: string) =>
				Effect.sync(() => ([...container().querySelectorAll("button")].some((button) => button.textContent === label) ? "offered" : "not offered")),
			openJob: () =>
				Effect.sync(() => {
					const detail = container().querySelector('[aria-label="Job detail"]')?.textContent;
					return detail === undefined ? "no detail" : (engine.client.backend.state.jobs.find((job) => detail.includes(job.id))?.id ?? "unknown job");
				}),
			opensFailedJob: (id: string) => Effect.andThen(ui.clickControl({ name: id, role: "button" }), ui.settle()),
			opensNoteStatistics: () => Effect.andThen(ui.clickControl({ name: "Note statistics", role: "link" }), ui.settle()),
			queueFilter: () => Effect.sync(() => [...container().querySelectorAll("select option")].map((option) => option.getAttribute("value"))),
			settle: ui.settle,
			shown: ui.shown,
		};
	},
});

export function adminScreen(path = "/admin/jobs", role: typeof AppAccess.Role.Type = "admin") {
	return adminScreens.trait("screen", `alice, signed in as ${role === "admin" ? "an admin" : `a ${role}`}, opens ${path}`, function* (engine) {
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
			return connectModules([foundationRegistration(client), adminRegistration(client)]);
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
					session={{ user: { id, permissions: access.permissions } }}
					userId={id}
				/>,
			);
		}
		engine.switchSession = () => show("bob");
		yield* Effect.promise(() => show("alice"));
	});
}

export const twoFailedJobs = adminScreens.trait("backend", "two note word-count jobs have failed", (engine) => {
	engine.client.backend.state.jobs = [failedJob("first-job"), failedJob("second-job")];
});
export const countedNotes = adminScreens.trait("backend", "the backend has counted 7 notes with 53 words and 2 counts pending", (engine) => {
	engine.client.backend.state.statistics = { notes: 7, pending: 2, words: 53 };
});
