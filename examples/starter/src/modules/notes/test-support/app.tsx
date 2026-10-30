import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { createMemoryHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { SqlClient } from "effect/sql";
import { authDatabase } from "@shivaedev/identity/server/better-auth/mount.ts";
import { authTestDatabase } from "@shivaedev/identity/server/better-auth/testDatabase.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { App } from "#client/App.tsx";
import { makeAuth } from "#client/auth.ts";
import { LoginScreen } from "#client/LoginScreen.tsx";
import { connectModules } from "#client/Module.ts";
import { makeNotesClient } from "#modules/notes/client/make.ts";
import { notesRegistration } from "#modules/notes/client/registration.tsx";
import { heldSignIn } from "#modules/notes/test-support/heldSignIn.ts";
import { screenActions } from "#modules/notes/test-support/screenActions.ts";
import { screenObservations } from "#modules/notes/test-support/screenObservations.ts";
import { credentials } from "#test-support/authHttp.ts";
import { createCookieHost } from "#test-support/createCookieHost.ts";
import { postgres } from "#test-support/postgres.ts";
import { acquireScreen, type ScreenSurface } from "#test-support/screenState.ts";
import { mintUser } from "#test-support/sessionPrecondition.ts";

const alice = credentials("alice");

export const notesApp = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const host = yield* createCookieHost();
		const database = yield* PostgresTestDatabase;
		const authStorage = authTestDatabase(yield* authDatabase(database.url));
		const signIn = heldSignIn(host.fetch);
		const auth = makeAuth({ baseUrl: host.baseUrl, fetchOptions: { customFetchImpl: signIn.fetch } });
		const screen: ScreenSurface = { view: undefined };
		return { ...host, ...screen, auth, authStorage, headers: new Headers(), history: createMemoryHistory({ initialEntries: ["/sign-in"] }), signIn };
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
			const users = yield* engine.authStorage.users;
			const notes = yield* sql<{
				title: string;
				version: number;
				userId: string;
			}>`select title, version, user_id from notes order by id`;
			return notes.map(({ title, version, userId }) => ({ email: users.find(({ id }) => id === userId)?.email ?? null, title, version }));
		}),
		storedSessions: Effect.gen(function* () {
			return (yield* engine.authStorage.sessions).map(({ email }) => ({ email }));
		}),
		storedUsers: Effect.gen(function* () {
			return (yield* engine.authStorage.users).map(({ email }) => ({ email }));
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

export function notesHostScreen(initial = "/sign-in") {
	return notesApp.trait("screen", `the real app is open at ${initial}`, function* (engine) {
		engine.history.replace(initial);
		const view = yield* acquireScreen(engine);
		function connect() {
			return connectModules([
				notesRegistration(
					makeNotesClient(`${engine.baseUrl}/rpc`, {
						...(engine.headers.has("cookie")
							? { headers: Object.fromEntries(engine.headers), webSocketConstructor: layerWebSocketConstructorWS }
							: {}),
					}),
				),
			]);
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

export function signedInAccount() {
	return notesApp.trait("account", "Alice has a minted session", function* (engine) {
		const { headers } = yield* mintUser({ origin: engine.baseUrl }, "alice");
		engine.headers = headers;
		engine.fetch = globalThis.fetch;
		engine.auth = makeAuth({ baseUrl: engine.baseUrl, fetchOptions: { customFetchImpl: engine.fetch, headers } });
	});
}
