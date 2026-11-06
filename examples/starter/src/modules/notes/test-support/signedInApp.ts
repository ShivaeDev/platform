import { DateTime, Effect } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { notes } from "#modules/notes/notes.ts";
import { notesHttp } from "#modules/notes/test-support/http.ts";
import { screenActions } from "#modules/notes/test-support/screenActions.ts";
import { screenObservations } from "#modules/notes/test-support/screenObservations.ts";
import { configured, postgres } from "#test-support/postgres.ts";
import { mintUser } from "#test-support/sessionPrecondition.ts";
import { uiScreenVerbs } from "#test-support/uiScreenVerbs.ts";
import { appScreen } from "./appScreen.tsx";

export const signedInApp = storyKit({
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	*create() {
		const screen = yield* appScreen({ account: { name: "alice" }, route: "/" });
		const bob = yield* mintUser(screen, "bob");
		const bobClient = yield* notesHttp(screen.baseUrl, bob.headers.get("cookie") ?? "", screen.origin);
		return { ...screen, bob, bobClient };
	},
	inspect: ({ history, view }) => ({ route: history.location.pathname, text: view.container.textContent }),
	layer: postgres,
	name: "signed-in app",
	runIf: configured,
	stages: [],
	verbs: (engine, story) => ({
		...screenActions(engine, story.tell),
		...screenObservations(engine),
		...uiScreenVerbs(engine, story.tell),
		bobAddsNote: (title: string) => {
			story.tell(`bob adds ${JSON.stringify(title)} from another client`);
			return engine.bobClient["notes.create"]({ title });
		},
		listKey: (name: "alice" | "bob") => notes.bucket.userId(name === "alice" ? engine.account.user.id : engine.bob.user.id),
		waitsForHint: () => engine.observed.watchHints(),
	}),
});
