import { createMemoryHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { App } from "#client/App.tsx";
import { makeNotesClient } from "#client/makeNotes.ts";
import { credentials } from "#test-support/authHttp.ts";
import { createCookieHost } from "#test-support/createCookieHost.ts";
import { postgres } from "#test-support/postgres.ts";
import { screenActions } from "#test-support/screenActions.ts";
import { observeScreen, screenObservations } from "#test-support/screenObservations.ts";
import { acquireScreen, type ScreenSurface } from "#test-support/screenState.ts";

const alice = credentials("alice");

export const notesApp = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const host = yield* createCookieHost();
		const screen: ScreenSurface = { view: undefined };
		return { ...host, ...screen, history: createMemoryHistory({ initialEntries: ["/sign-in"] }) };
	},
	inspect: ({ history, view }) => ({ route: history.location.pathname, text: view?.container.textContent }),
	layer: postgres,
	name: "notes app",
	stages: ["account", "screen"],
	verbs: (engine, story) => ({
		...screenActions(engine, story.tell),
		...screenObservations(engine, story.tell),
		notesAreStored: Effect.fn("NotesStory.notesAreStored")(function* (...notes: readonly { title: string; version: number }[]) {
			story.tell(`PostgreSQL holds ${JSON.stringify(notes)} owned by Alice`);
			const sql = yield* SqlClient.SqlClient;
			expect(yield* sql`select n.title, n.version, u.email from notes n left join "user" u on u.id = n."ownerId" order by n.id`).toEqual(
				notes.map((note) => ({ ...note, email: alice.email })),
			);
		}),
		openedNoteIsStored: Effect.fn("NotesStory.openedNoteIsStored")(function* () {
			story.tell("the editor route opens the note stored in PostgreSQL");
			const sql = yield* SqlClient.SqlClient;
			const rows = yield* sql<{ id: number }>`select id from notes`;
			expect(rows).toHaveLength(1);
			expect(engine.history.location.pathname).toBe(`/notes/${rows[0]?.id}`);
		}),
		routeIs: (path: string) => observeScreen(story.tell)(`the app is at ${path}`, () => expect(engine.history.location.pathname).toBe(path)),
		sessionIsStored: Effect.fn("NotesStory.sessionIsStored")(function* (signedIn: boolean) {
			story.tell(`PostgreSQL ${signedIn ? "holds Alice's session" : "has no signed-in session"}`);
			const sql = yield* SqlClient.SqlClient;
			expect(yield* sql`select email from "user"`).toEqual([{ email: alice.email }]);
			expect(yield* sql`select u.email from "session" s join "user" u on u.id = s."userId"`).toEqual(signedIn ? [{ email: alice.email }] : []);
		}),
	}),
});

export function aliceAccount() {
	return notesApp.trait("account", "Alice has an account and is signed out", (engine) =>
		Effect.promise(async () => {
			expect((await engine.auth.client.signUp.email(alice)).error).toBeNull();
			expect((await engine.auth.client.signOut()).error).toBeNull();
		}),
	);
}

export function signInScreen() {
	return notesApp.trait("screen", "the real app is open on the sign-in screen", function* (engine) {
		const view = yield* acquireScreen(engine);
		function connect() {
			return makeNotesClient(`${engine.baseUrl}/rpc`, (client) =>
				HttpClient.transformResponse(client, Effect.provideService(FetchHttpClient.Fetch, engine.fetch)),
			);
		}
		yield* Effect.promise(() => view.render(<App auth={engine.auth} connect={connect} history={engine.history} />));
	});
}
