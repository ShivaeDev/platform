import { createMemoryHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { act } from "react";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { authCall } from "@shivaedev/identity/client/adapters/authCall.ts";
import { browserSessionMemory } from "@shivaedev/identity/client/adapters/browserSessionMemory.ts";
import { rememberSession } from "@shivaedev/identity/client/SessionMemory.ts";
import { loadQuery } from "@shivaedev/react/adapters/loadQuery.ts";
import { authAction } from "@shivaedev/react/client/authAction.ts";
import { SessionApp } from "@shivaedev/react/client/SessionApp.ts";
import { sessionRouter } from "@shivaedev/react/client/sessionRouter.ts";
import { RouterProvider } from "@shivaedev/react/RouterProvider.ts";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { App } from "#client/App.tsx";
import type { AuthActions } from "#client/adapters/auth.ts";
import type { Credentials } from "#client/Credentials.ts";
import { LoginScreen } from "#client/LoginScreen.tsx";
import { Notices } from "#client/Notices.tsx";
import { routing } from "#client/routing.tsx";
import { CodePreview, type CodePreviewLine } from "#modules/notes/client/CodePreview.tsx";
import { notesClient } from "#modules/notes/test-support/client.ts";
import { LoadedScreen } from "#modules/notes/test-support/LoadedScreen.tsx";
import { screenAuth } from "#modules/notes/test-support/screenAuth.ts";
import { connectedIn, type Screen, screenApp } from "#modules/notes/test-support/screenState.ts";
import { settleQuery } from "#modules/notes/test-support/settleQuery.ts";
import { appAuth } from "#test-support/appAuth.ts";
import { acquireScreen, screenView } from "#test-support/screenState.ts";

export const openRoute = Effect.fn("ScreenStory.openRoute")(function* (engine: Screen, route: string, signedIn = true) {
	engine.client.session.signedIn = signedIn;

	const view = yield* acquireScreen(engine);
	const { connection, live } = connectedIn(engine, view.registry);
	if (signedIn) {
		if (route === "/") {
			live.notes.list.query();
		} else {
			live.notes.get.query({ id: 1 });
		}
		view.registry.mount(live.notes[LiveConnection].connection);
		yield* screenDriver({
			act,
			pending: () => view.registry.get(live.notes[LiveConnection].status).connection !== "live",
			root: view.container,
			tell: () => undefined,
		}).settle();
	}
	const router = sessionRouter({
		...routing,
		auth: screenAuth(),
		connection,
		history: createMemoryHistory({ initialEntries: [route] }),
		registry: view.registry,
		session: () => (signedIn ? { user: { id: "alice" } } : undefined),
	});
	engine.router = router;
	yield* Effect.promise(() => view.render(<RouterProvider router={router} />));
	if (signedIn) {
		yield* settleQuery(engine);
	}
});

export const openLogin = Effect.fn("ScreenStory.openLogin")(function* (engine: Screen, rejection: string | undefined) {
	engine.login.outcome = rejection;
	const auth: AuthActions = {
		resetPassword: screenAuth().resetPassword,
		signOut: authAction(authCall<void, unknown, never>(() => Promise.resolve({ data: {}, error: null }))),
		submit: authAction(
			authCall(({ mode, credentials }: { mode: "sign-in" | "sign-up"; credentials: Credentials }) => {
				engine.login.calls.push({ credentials, mode });
				if (engine.login.unavailable) {
					return Promise.reject(new Error("offline"));
				}
				if (engine.login.outcome === undefined) {
					return Promise.resolve({ data: {}, error: null });
				}
				return Promise.resolve({
					data: null,
					error: {
						code: mode === "sign-up" ? "USER_ALREADY_EXISTS" : "INVALID_EMAIL_OR_PASSWORD",
						message: engine.login.outcome,
						status: HttpStatus.fromLiteral("Unauthorized"),
						statusText: "Unauthorized",
					},
				});
			}),
		),
	};
	const view = yield* acquireScreen(engine);
	engine.pending = () => view.registry.get(auth.submit).waiting;
	yield* Effect.promise(() =>
		view.render(
			<LoginScreen
				auth={auth}
				onAuthenticated={() => {
					engine.login.authenticated.push(engine.login.calls.at(-1)?.mode);
				}}
			/>,
		),
	);
});

export const openApp = Effect.fn("ScreenStory.openApp")(function* (engine: Screen, route: string, options: Parameters<typeof appAuth>[0]) {
	const fixture = appAuth(options);
	engine.auth = fixture;
	engine.pending = () =>
		(engine.view?.registry.get(fixture.auth.session.atom).waiting ?? false)
		|| (engine.view !== undefined
			&& (engine.view.registry.get(fixture.auth.actions.submit).waiting || engine.view.registry.get(fixture.auth.actions.signOut).waiting));
	const view = yield* acquireScreen(engine);
	const history = createMemoryHistory({ initialEntries: [route] });
	yield* Effect.promise(() => view.render(<App app={screenApp(engine)} auth={fixture.auth} history={history} />));
	yield* screenDriver({
		act,
		pending: () => view.registry.get(fixture.auth.session.atom).waiting,
		root: view.container,
		tell: () => undefined,
	}).settle();
});

function launchApp(engine: Screen, view: Rendered, check: "held" | "failing") {
	const fixture = appAuth({
		baseUrl: "http://returning.story.test",
		sessionFailure: check === "failing",
		sessionHeld: check === "held",
		signedIn: true,
	});
	engine.auth = fixture;
	engine.pending = () => check === "failing" && view.registry.get(fixture.auth.session.atom).waiting;
	return Effect.promise(() => view.render(<App app={screenApp(engine)} auth={fixture.auth} history={createMemoryHistory()} />));
}

export const openReturningApp = Effect.fn("ScreenStory.openReturningApp")(function* (engine: Screen, check: "held" | "failing") {
	yield* rememberSession({ session: { expiresAt: new Date("2099-01-01T00:00:00.000Z"), id: "alice-session" }, user: { id: "alice" } }).pipe(
		Effect.provide(browserSessionMemory),
	);
	const view = yield* acquireScreen(engine);
	yield* launchApp(engine, view, check);
});

export const relaunchApp = Effect.fn("ScreenStory.relaunchApp")(function* (engine: Screen) {
	const view = screenView(engine);
	yield* Effect.promise(() => view.render(null));
	yield* launchApp(engine, view, "held");
});

export const openNotes = Effect.fn("ScreenStory.openNotes")(function* (engine: Screen, signOutFailure?: string) {
	const view = yield* acquireScreen(engine);
	const signOut =
		signOutFailure === undefined
			? undefined
			: authAction(
					authCall(() => {
						engine.signOutCalls.push(undefined);
						return Promise.resolve({
							data: null,
							error: { message: signOutFailure, status: HttpStatus.fromLiteral("BadRequest"), statusText: "Bad Request" },
						});
					}),
				);
	engine.pending = () => signOut !== undefined && view.registry.get(signOut).waiting;
	const { live } = connectedIn(engine, view.registry);
	live.notes.list.query();
	view.registry.mount(live.notes[LiveConnection].connection);
	yield* screenDriver({
		act,
		pending: () => view.registry.get(live.notes[LiveConnection].status).connection !== "live",
		root: view.container,
		tell: () => undefined,
	}).settle();
	const loaded = yield* Effect.promise(() => loadQuery(view.registry, live.notes.list.query(), { abortController: new AbortController() }));
	yield* Effect.promise(() =>
		view.render(
			<Notices>
				<LoadedScreen client={live.notes} loaded={loaded} signOut={signOut} />
			</Notices>,
		),
	);
	yield* settleQuery(engine);
});

export const openSession = Effect.fn("ScreenStory.openSession")(function* (engine: Screen) {
	const alice = engine.client;
	const bob = yield* notesClient();
	function connection({ id }: { readonly id: string }) {
		return id === "alice" ? alice : bob;
	}
	const auth = screenAuth();
	const history = createMemoryHistory({ initialEntries: ["/"] });
	function recheck() {
		return undefined;
	}
	const view = yield* acquireScreen(engine);
	async function switchSession(id: string) {
		engine.client = connection({ id });
		await view.render(<SessionApp {...routing} app={screenApp(engine)} auth={auth} history={history} recheck={recheck} session={{ user: { id } }} />);
	}
	engine.switchSession = switchSession;
	yield* Effect.promise(() => switchSession("alice"));
	yield* settleQuery(engine);
});

export const openCodePreview = Effect.fn("ScreenStory.openCodePreview")(function* (engine: Screen, lines: readonly CodePreviewLine[]) {
	const view = yield* acquireScreen(engine);
	yield* Effect.promise(() => view.render(<CodePreview label="Note changes" lines={lines} />));
});
