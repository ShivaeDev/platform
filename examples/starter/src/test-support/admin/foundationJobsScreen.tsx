import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { DateTime, Effect } from "effect";
import { JobsView } from "@shivaedev/admin/client/JobsView.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { foundation } from "#admin/foundation.ts";
import { makeFoundationClient } from "#client/admin/foundation.ts";
import { startHost } from "#test-support/host.ts";
import { configured, postgres } from "#test-support/postgres.ts";
import { acquireScreen, type ScreenSurface, screenView } from "#test-support/screenState.ts";
import { mintUser } from "#test-support/sessionPrecondition.ts";
import { uiScreenVerbs } from "#test-support/uiScreenVerbs.ts";

export const foundationJobsScreen = storyKit({
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	*create() {
		const host = yield* startHost();
		const { headers } = yield* mintUser(host, "operator", "admin");
		const client = makeFoundationClient(`${host.baseUrl}/rpc`, {
			headers: { cookie: headers.get("cookie") ?? "", origin: host.origin },
			webSocketConstructor: layerWebSocketConstructor,
		});
		const surface: ScreenSurface = { activity: client.activity, view: undefined };
		return { client, surface };
	},
	inspect: ({ surface }) => ({ text: surface.view?.container.textContent }),
	layer: postgres,
	name: "foundation jobs screen",
	runIf: configured,
	stages: ["screen"],
	verbs: ({ surface }, story) => ({
		...uiScreenVerbs(surface, story.tell),
		queueFilter: () => Effect.sync(() => [...screenView(surface).container.querySelectorAll("select option")].map(({ textContent }) => textContent)),
	}),
});

export const foundationJobsOpen = foundationJobsScreen.trait("screen", "an admin opens Jobs administration", function* ({ client, surface }) {
	const view = yield* acquireScreen(surface);
	yield* Effect.promise(() => view.render(<JobsView api={client.jobs} queues={foundation.queues.map(({ name }) => name)} />));
});
