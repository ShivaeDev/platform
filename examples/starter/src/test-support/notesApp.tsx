import { createMemoryHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { SqlClient } from "effect/sql";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { App } from "#client/App.tsx";
import { makeAuth } from "#client/auth.ts";
import { LoginScreen } from "#client/LoginScreen.tsx";
import { makeNotesClient } from "#client/makeNotes.ts";
import { credentials } from "#test-support/authHttp.ts";
import { createCookieHost } from "#test-support/createCookieHost.ts";
import { heldSignIn } from "#test-support/heldSignIn.ts";
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
		const signIn = heldSignIn(host.fetch);
		const auth = makeAuth({ baseUrl: host.baseUrl, fetchOptions: { customFetchImpl: signIn.fetch } });
		const screen: ScreenSurface = { view: undefined };
		return { ...host, ...screen, auth, history: createMemoryHistory({ initialEntries: ["/sign-in"] }), signIn };
	},
	inspect: ({ history, view }) => ({ route: history.location.pathname, text: view?.container.textContent }),
	layer: postgres,
	name: "notes app",
	stages: ["account", "transport", "screen"],
	verbs: (engine, story) => ({
		...screenActions(engine, story.tell),
		...screenObservations(engine),
		button: (label: string) => {
			if (engine.view === undefined) {
				throw new Error("No screen is open");
			}
			const button = [...engine.view.container.querySelectorAll("button")].find((element) => element.textContent === label);
			return button === undefined ? undefined : { disabled: button.disabled, text: button.textContent };
		},
		releaseSignIn: () =>
			Effect.sync(() => {
				story.tell("release the real sign-in response");
				engine.signIn.release();
			}),
		route: () => engine.history.location.pathname,
		signInFailure: () => {
			if (engine.view === undefined) {
				throw new Error("No sign-in screen is open");
			}
			return AsyncResult.error(engine.view.registry.get(engine.auth.actions.submit));
		},
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

export function signInResponseHeld() {
	return notesApp.trait("transport", "the real sign-in response is held", (engine) => Effect.sync(() => engine.signIn.hold()));
}

export function authScreen() {
	return notesApp.trait("screen", "the sign-in screen uses the real auth host", function* (engine) {
		const view = yield* acquireScreen(engine);
		yield* Effect.promise(() => view.render(<LoginScreen auth={engine.auth.actions} onAuthenticated={() => undefined} />));
	});
}
