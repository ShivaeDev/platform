import { createMemoryHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { SqlClient } from "effect/sql";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { App } from "#client/App.tsx";
import { makeNotesClient } from "#client/makeNotes.ts";
import { credentials } from "#test-support/authHttp.ts";
import { createCookieHost } from "#test-support/createCookieHost.ts";
import { postgres } from "#test-support/postgres.ts";
import { screenActions } from "#test-support/screenActions.ts";
import { screenObservations } from "#test-support/screenObservations.ts";
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
		...screenObservations(engine),
		route: () => engine.history.location.pathname,
		storedNoteIds: Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			return yield* sql<{ id: number }>`select id from notes`;
		}),
		storedNotes: Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			return yield* sql`select n.title, n.version, u.email from notes n left join "user" u on u.id = n."ownerId" order by n.id`;
		}),
		storedSessions: Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			return yield* sql`select u.email from "session" s join "user" u on u.id = s."userId"`;
		}),
		storedUsers: Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			return yield* sql`select email from "user"`;
		}),
	}),
});

export function aliceAccount() {
	return notesApp.trait("account", "Alice has an account and is signed out", (engine) =>
		Effect.promise(async () => {
			const signup = await engine.auth.client.signUp.email(alice);
			if (signup.error !== null) {
				throw new Error(`Account setup failed: ${JSON.stringify(signup.error)}`);
			}
			const signout = await engine.auth.client.signOut();
			if (signout.error !== null) {
				throw new Error(`Account setup sign-out failed: ${JSON.stringify(signout.error)}`);
			}
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
