import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { createMemoryHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { authTestDatabase } from "@shivaedev/identity/server/better-auth/testDatabase.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { App } from "#client/App.tsx";
import { makeAuth } from "#client/auth.ts";
import { LoginScreen } from "#client/LoginScreen.tsx";
import { connectModules } from "#client/Module.ts";
import { makeNotesClient } from "#modules/notes/client/make.ts";
import { notesRegistration } from "#modules/notes/client/registration.tsx";
import { heldSignIn } from "#modules/notes/test-support/heldSignIn.ts";
import { notesMemberScreens } from "#modules/notes/test-support/memberScreens.tsx";
import { screenActions } from "#modules/notes/test-support/screenActions.ts";
import { screenObservations } from "#modules/notes/test-support/screenObservations.ts";
import { credentials } from "#test-support/authHttp.ts";
import { createCookieHost } from "#test-support/createCookieHost.ts";
import { postgres } from "#test-support/postgres.ts";
import { acquireScreen, type ScreenSurface, screenView } from "#test-support/screenState.ts";
import { mintUser } from "#test-support/sessionPrecondition.ts";
import { settleScreen } from "#test-support/settleScreen.ts";
import { uiScreenVerbs } from "#test-support/uiScreenVerbs.ts";

const alice = credentials("alice");

export const notesApp = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const host = yield* createCookieHost();
		const authStorage = yield* authTestDatabase;
		const signIn = heldSignIn(host.fetch);
		const auth = makeAuth({ baseUrl: host.baseUrl, fetchOptions: { customFetchImpl: signIn.fetch } });
		const screen: ScreenSurface = { view: undefined };
		return {
			...host,
			...screen,
			auth,
			authStorage,
			headers: new Headers(),
			history: createMemoryHistory({ initialEntries: ["/sign-in"] }),
			members: notesMemberScreens(host.baseUrl),
			signIn,
		};
	},
	inspect: ({ history, view }) => ({ route: history.location.pathname, text: view?.container.textContent }),
	layer: postgres,
	name: "notes app",
	stages: ["account", "transport", "screen"],
	verbs: (engine, story) => {
		const quietly = screenActions(engine, () => undefined);
		return {
			...screenActions(engine, story.tell),
			...uiScreenVerbs(engine, story.tell),
			...engine.members.verbs(story.tell),
			...screenObservations(engine),
			addsNote: (title: string) =>
				Effect.gen(function* () {
					story.tell(`alice adds the note ${JSON.stringify(title)}`);
					yield* quietly.enter(title);
					yield* quietly.click("Add note");
					yield* settleScreen(engine, story.tell);
				}),
			arrivesAt: (path: string) =>
				Effect.callback<void>((resume) => {
					if (engine.history.location.pathname === path) {
						resume(Effect.void);
						return;
					}
					const unsubscribe = engine.history.subscribe(({ location }) => {
						if (location.pathname === path) {
							unsubscribe();
							resume(Effect.void);
						}
					});
					return Effect.sync(unsubscribe);
				}).pipe(
					Effect.timeoutOrElse({ duration: "10 seconds", orElse: () => Effect.die(`The app never reached ${path}`) }),
					Effect.andThen(settleScreen(engine, story.tell)),
				),
			route: () => Effect.sync(() => engine.history.location.pathname),
			signInButton: () =>
				Effect.sync(() => {
					const button = [...screenView(engine).container.querySelectorAll("button")].find((element) => element.type === "submit");
					return button === undefined ? "missing" : `${button.textContent}, ${button.disabled ? "disabled" : "enabled"}`;
				}),
			signsIn: (password: string) =>
				Effect.gen(function* () {
					story.tell(`alice signs in with ${password === alice.password ? "her password" : "a wrong password"}`);
					yield* quietly.enter(alice.email, "Email");
					yield* quietly.enter(password, "Password");
					yield* quietly.click("Sign in");
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
		};
	},
});

export function aliceAccount() {
	return notesApp.trait("account", "alice has an account and is signed out", (engine) =>
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
		engine.pending = () =>
			view.registry.get(engine.auth.session.atom).waiting
			|| view.registry.get(engine.auth.actions.submit).waiting
			|| view.registry.get(engine.auth.actions.signOut).waiting;
		function connect() {
			const client = makeNotesClient(`${engine.baseUrl}/rpc`, {
				...(engine.headers.has("cookie") ? { headers: Object.fromEntries(engine.headers), webSocketConstructor: layerWebSocketConstructorWS } : {}),
			});
			engine.activity = clientActivity(client);
			return connectModules([notesRegistration(client)]);
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
		engine.pending = () => view.registry.get(engine.auth.actions.submit).waiting;
		yield* Effect.promise(() => view.render(<LoginScreen auth={engine.auth.actions} onAuthenticated={() => undefined} />));
	});
}

export function signedInAccount() {
	return notesApp.trait("account", "alice has a signed-in session", function* (engine) {
		const { headers } = yield* mintUser({ origin: engine.baseUrl }, "alice");
		engine.headers = headers;
		engine.fetch = globalThis.fetch;
		engine.auth = makeAuth({ baseUrl: engine.baseUrl, fetchOptions: { customFetchImpl: engine.fetch, headers } });
	});
}

export function signedInMembers(...names: readonly string[]) {
	return notesApp.trait("screen", `${names.join(" and ")} open their own signed-in notes screens`, function* (engine) {
		for (const name of names) {
			const { cookies } = yield* mintUser({ origin: engine.baseUrl }, name);
			yield* engine.members.open(name, cookies);
		}
	});
}
