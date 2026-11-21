import { createMemoryHistory, type RouterHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import { activityScreenSignal, clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { isForbidden } from "@shivaedev/errors/taxonomy.ts";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type AppConnection, clientApp } from "#client/app.ts";
import type { SessionUser } from "#client/module.ts";
import { type Backend, backendProtocol } from "#test/client-app/backend.ts";
import { type Screen, screenWarnings } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";
import { Host } from "#test/session-app/Host.tsx";
import { accountModule, countModule, notesModule, ReadReports, reportsModule } from "#test/session-app/modules.tsx";

interface State {
	readonly backend: Backend;
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
		(): State => ({ backend: { count: 0, countReads: 0, viewer: "" } }),
		(state, screen) => ({
			count: () => Effect.sync(() => opened(state).container.querySelector('output[aria-label="Count"]')?.textContent ?? "no count"),
			follow: (link: string) => settled(state, screen, () => driver(state, screen).click({ name: link, role: "link" })),
			heading: () => Effect.sync(() => opened(state).container.querySelector("h1")?.textContent ?? "no heading"),
			location: () => Effect.sync(() => opened(state).history.location.href),
			path: () => Effect.sync(() => opened(state).history.location.pathname),
			returnTo: () => Effect.sync(() => new URLSearchParams(opened(state).history.location.search).get("returnTo") ?? "none"),
			signIn: () => settled(state, screen, () => driver(state, screen).click({ name: "Sign in", role: "button" })),
		}),
	),
);

export function openedAt(path: string, viewer?: Viewer, refused = false) {
	const outcome = refused ? ", which refuses them" : "";
	return sessionApps.trait("screen", `${viewer ?? "a signed-out visitor"} opens the app at ${path}${outcome}`, function* ({ screen, state }) {
		state.backend.count = 3;
		const app = clientApp([accountModule, countModule, notesModule, reportsModule], {
			protocol: backendProtocol(state.backend),
			url: "memory://session-app",
		});
		const recorded = {
			...app,
			connect: (session: unknown, registry: Parameters<typeof app.connect>[1]) => {
				state.connection = app.connect(session, registry);
				return state.connection;
			},
		};
		state.history = createMemoryHistory({ initialEntries: [path] });
		state.view = yield* screen.open(
			<Host app={recorded} history={state.history} initial={viewer === undefined ? null : VIEWERS[viewer]} signedIn={VIEWERS.alice} />,
			refused ? { onCaughtError: screenWarnings.expectCaughtError(isForbidden) } : undefined,
		);
		yield* driver(state, screen).settle();
	});
}
