import { Effect } from "effect";
import { activityScreenSignal, clientActivity } from "@shivaedev/contract/clientActivity.ts";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type AppConnection, clientApp } from "#client/app.ts";
import { type ClientModule, clientModule } from "#client/module.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { type Backend, backendProtocol } from "#test/client-app/backend.ts";
import { profileModule, slotModule, summaryModule, tallyModule } from "#test/client-app/modules.tsx";
import { Shell, SignedOut } from "#test/client-app/views.tsx";
import type { Screen } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";

interface State {
	readonly backend: Backend;
	connection?: AppConnection;
	view?: Rendered;
}

const MODULES = {
	"a counter both modules name": [tallyModule, summaryModule],
	"a session-scoped profile": [profileModule],
	"two modules with every shell slot around one with none": [slotModule("First"), clientModule({}, () => ({})), slotModule("Second")],
} satisfies Record<string, readonly ClientModule[]>;

type Modules = keyof typeof MODULES;

function opened(state: State) {
	if (state.view === undefined || state.connection === undefined) {
		throw new Error("No app is open; give the story an app trait");
	}
	return { connection: state.connection, container: state.view.container };
}

function driver(state: State, screen: Screen) {
	const { connection, container } = opened(state);
	return screen.driver(container, activityScreenSignal(clientActivity(connection)));
}

function texts(state: State, selector: string) {
	return Effect.sync(() => [...opened(state).container.querySelectorAll(selector)].map((node) => node.textContent));
}

export const clientApps = storyKit(
	screenKit(
		"an app connected from its client modules",
		(): State => ({ backend: { count: 0, countReads: 0, viewer: "" } }),
		(state, screen) => ({
			bump: () => Effect.suspend(() => Effect.andThen(driver(state, screen).click({ name: "Bump", role: "button" }), driver(state, screen).settle())),
			count: (module: "Summary" | "Tally") => Effect.map(texts(state, `output[aria-label="${module}"]`), (shown) => shown.join(", ")),
			countReads: () => Effect.sync(() => state.backend.countReads),
			footers: () => texts(state, "footer p"),
			menu: () => texts(state, "nav a"),
			overlays: () => texts(state, "aside"),
			viewer: () => Effect.map(texts(state, "nav output"), (shown) => shown.join(", ")),
		}),
	),
);

export function appOpen(modules: Modules, viewer?: "alice") {
	return clientApps.trait("screen", `${viewer ?? "a signed-out visitor"} opens an app of ${modules}`, function* ({ screen, state }) {
		state.backend.viewer = viewer === undefined ? "read for a visitor" : `read for ${viewer}`;
		const app = clientApp(MODULES[modules], { protocol: backendProtocol(state.backend), url: "memory://client-app" });
		function record(connection: AppConnection) {
			state.connection = connection;
			return connection;
		}
		state.view = yield* screen.open(
			<SessionBoundary
				connect={(session, registry) => record(app.connect(session, registry))}
				identify={(session: string) => session}
				recheck={() => undefined}
				session={viewer}
				signedOut={<SignedOut app={app} record={record} />}
				warm={app.warm}
			>
				{(connection) => <Shell connection={connection} />}
			</SessionBoundary>,
		);
		yield* driver(state, screen).settle();
	});
}
