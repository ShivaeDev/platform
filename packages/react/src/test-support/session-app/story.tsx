import { createMemoryHistory, type RouterHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import { activityScreenSignal, clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { isForbidden } from "@shivaedev/errors/taxonomy.ts";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type AppConnection, clientApp } from "#client/app.ts";
import type { SessionUser } from "#client/module.ts";
import type { SessionRouting } from "#client/sessionRouter.ts";
import { type Screen, screenWarnings } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";
import { type SessionBackend, sessionBackendProtocol } from "#test/session-app/backend.ts";
import { Host } from "#test/session-app/Host.tsx";
import { accountModule, brokenModule, countModule, diaryModule, notesModule, ReadReports, reportsModule } from "#test/session-app/modules.tsx";
import { NotFound } from "#test/session-app/screens.tsx";

interface State {
	readonly backend: SessionBackend;
	readonly caught: string[];
	checks: number;
	connection?: AppConnection;
	history?: RouterHistory;
	view?: Rendered;
}

const VIEWERS = {
	alice: { user: { id: "alice", permissions: [] } },
	"alice, who may read reports": { user: { id: "alice", permissions: [ReadReports] } },
} satisfies Record<string, SessionUser>;

type Viewer = keyof typeof VIEWERS;

function opened(state: State) {
	if (state.view === undefined || state.connection === undefined || state.history === undefined) {
		throw new Error("No session app is open; give the story an opened trait");
	}
	return { connection: state.connection, container: state.view.container, history: state.history };
}

function driver(state: State, screen: Screen) {
	const { connection, container } = opened(state);
	return screen.driver(container, activityScreenSignal(clientActivity(connection)));
}

function settled<A>(state: State, screen: Screen, action: () => Effect.Effect<A>) {
	return Effect.suspend(action).pipe(Effect.andThen(Effect.suspend(() => driver(state, screen).settle())));
}

export const sessionApps = storyKit(
	screenKit(
		"a session app routing its client modules",
		(): State => ({ backend: { count: 0, countReads: 0, diaryReads: 0, viewer: "" }, caught: [], checks: 0 }),
		(state, screen) => ({
			caughtByApp: () => Effect.sync(() => [...state.caught]),
			count: () => Effect.sync(() => opened(state).container.querySelector('output[aria-label="Count"]')?.textContent ?? "no count"),
			diary: () => Effect.sync(() => opened(state).container.querySelector('output[aria-label="Diary"]')?.textContent ?? "no diary"),
			diaryReads: () => Effect.sync(() => state.backend.diaryReads),
			follow: (link: string) => settled(state, screen, () => driver(state, screen).click({ name: link, role: "link" })),
			heading: () => Effect.sync(() => opened(state).container.querySelector("h1")?.textContent ?? "no heading"),
			location: () => Effect.sync(() => opened(state).history.location.href),
			path: () => Effect.sync(() => opened(state).history.location.pathname),
			returnTo: () => Effect.sync(() => new URLSearchParams(opened(state).history.location.search).get("returnTo") ?? "none"),
			sessionChecks: () => Effect.sync(() => state.checks),
			shellHeading: () => Effect.sync(() => opened(state).container.querySelector("[data-shell] h1")?.textContent ?? "no heading in the shell"),
			signIn: () => settled(state, screen, () => driver(state, screen).click({ name: "Sign in", role: "button" })),
		}),
	),
);

const ROUTINGS = {
	"its own not-found page": { notFound: NotFound },
	"no routing options": {},
	"refused routes hidden behind its not-found page": { hidden: true, notFound: NotFound },
	"route errors reported to the app": {},
} satisfies Record<string, SessionRouting>;

type Routing = keyof typeof ROUTINGS;

const CAUGHT = {
	"a broken screen": (error: unknown) => error instanceof Error && error.message === "Broken screen",
	forbidden: isForbidden,
};

export function openedAt(
	path: string,
	viewer?: Viewer,
	options: { readonly caught?: keyof typeof CAUGHT; readonly checkAnswers?: "signed out"; readonly routing?: Routing } = {},
) {
	const routing = options.routing ?? "no routing options";
	const checked = options.checkAnswers === undefined ? "" : ", and every session check answers signed out";
	const caught = options.caught === undefined ? "" : `, where React catches ${options.caught}`;
	const line = `${viewer ?? "a signed-out visitor"} opens an app with ${routing} at ${path}${checked}${caught}`;
	return sessionApps.trait("screen", line, function* ({ screen, state }) {
		state.backend.count = 3;
		const app = clientApp([accountModule, brokenModule, countModule, diaryModule, notesModule, reportsModule], {
			protocol: sessionBackendProtocol(state.backend),
			url: "memory://session-app",
		});
		const recorded = {
			...app,
			connect: (session: unknown, registry: Parameters<typeof app.connect>[1]) => {
				state.connection = app.connect(session, registry);
				return state.connection;
			},
		};
		const reported: SessionRouting =
			routing === "route errors reported to the app"
				? {
						onCatch: (error) => {
							state.caught.push(error instanceof Error ? error.message : "a thrown value that is not an Error");
						},
					}
				: ROUTINGS[routing];
		state.history = createMemoryHistory({ initialEntries: [path] });
		state.view = yield* screen.open(
			<Host
				answer={options.checkAnswers === undefined ? VIEWERS.alice : null}
				app={recorded}
				countCheck={() => {
					state.checks += 1;
				}}
				history={state.history}
				initial={viewer === undefined ? null : VIEWERS[viewer]}
				routing={reported}
			/>,
			options.caught === undefined ? undefined : { onCaughtError: screenWarnings.expectCaughtError(CAUGHT[options.caught]) },
		);
		yield* driver(state, screen).settle();
	});
}
