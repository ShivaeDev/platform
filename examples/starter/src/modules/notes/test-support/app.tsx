import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { createMemoryHistory } from "@tanstack/react-router";
import { DateTime, Effect } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { SqlClient } from "effect/sql";
import { clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { authTestDatabase } from "@shivaedev/identity/server/better-auth/testDatabase.ts";
import { clientApp } from "@shivaedev/react/client/app.ts";
import { mintUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { seedCookies } from "@shivaedev/test-story/server/adapters/seedCookies.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { App } from "#client/App.tsx";
import { accountModule } from "#client/accountModule.tsx";
import { makeAuth } from "#client/adapters/auth.ts";
import { LoginScreen } from "#client/LoginScreen.tsx";
import { notesModule } from "#modules/notes/client/module.tsx";
import { heldSignIn } from "#modules/notes/test-support/heldSignIn.ts";
import { notesMemberScreens } from "#modules/notes/test-support/memberScreens.tsx";
import { screenActions } from "#modules/notes/test-support/screenActions.ts";
import { screenObservations } from "#modules/notes/test-support/screenObservations.ts";
import { AppAuth } from "#server/AppAuth.ts";
import { credentials } from "#test-support/authHttp.ts";
import { createCookieHost } from "#test-support/createCookieHost.ts";
import { configured, postgres } from "#test-support/postgres.ts";
import { recordedApp } from "#test-support/recordedApp.ts";
import { acquireScreen, type ScreenSurface, screenView } from "#test-support/screenState.ts";
import { sessionRequests } from "#test-support/sessionRequests.ts";
import { settleScreen } from "#test-support/settleScreen.ts";
import { uiScreenVerbs } from "#test-support/uiScreenVerbs.ts";

const alice = credentials("alice");

export const notesApp = storyKit({
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const host = yield* createCookieHost();
		const authStorage = yield* authTestDatabase;
		const signIn = heldSignIn(host.fetch);
		const checks = sessionRequests(signIn.fetch);
		const auth = makeAuth({ baseUrl: host.baseUrl, fetchOptions: { customFetchImpl: checks.fetch } });
		const screen: ScreenSurface = { view: undefined };
		return {
			...host,
			...screen,
			auth,
			authStorage,
			headers: new Headers(),
			history: createMemoryHistory({ initialEntries: ["/sign-in"] }),
			members: notesMemberScreens(host.baseUrl),
			sessionPending: (registry: AtomRegistry.AtomRegistry) => checks.pending(registry, auth.session.atom),
			signIn,
		};
	},
	inspect: ({ history, view }) => ({ route: history.location.pathname, text: view?.container.textContent }),
	layer: postgres,
	name: "notes app",
	runIf: configured,
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
			engine.sessionPending(view.registry)
			|| view.registry.get(engine.auth.actions.submit).waiting
			|| view.registry.get(engine.auth.actions.signOut).waiting;
		const app = clientApp([accountModule, notesModule], {
			url: `${engine.baseUrl}/rpc`,
			...(engine.headers.has("cookie") ? { headers: Object.fromEntries(engine.headers), webSocketConstructor: layerWebSocketConstructor } : {}),
		});
		const recorded = recordedApp(app, (connection) => {
			engine.activities = [clientActivity(connection)];
		});

		yield* Effect.promise(() => view.render(<App app={recorded} auth={engine.auth} history={engine.history} />));
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
		const { cookies, headers } = yield* mintUser(AppAuth, { origin: engine.baseUrl }, "alice");
		engine.headers = headers;
		yield* seedCookies(cookies);
	});
}

export function signedInMembers(...names: readonly string[]) {
	return notesApp.trait("screen", `${names.join(" and ")} open their own signed-in notes screens`, function* (engine) {
		for (const name of names) {
			const { cookies } = yield* mintUser(AppAuth, { origin: engine.baseUrl }, name);
			yield* engine.members.open(name, cookies);
		}
	});
}
