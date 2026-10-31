import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { act } from "react";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { loadQuery } from "@shivaedev/react/adapters/loadQuery.ts";
import { authAction } from "@shivaedev/react/client/authAction.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { App } from "#client/App.tsx";
import { appRouter } from "#client/appRouter.tsx";
import type { AuthActions, Credentials } from "#client/auth.ts";
import { LoginScreen } from "#client/LoginScreen.tsx";
import { connectModules } from "#client/Module.ts";
import { SessionApp } from "#client/SessionApp.tsx";
import { CodePreview, type CodePreviewLine } from "#modules/notes/client/CodePreview.tsx";
import { notesRegistration } from "#modules/notes/client/registration.tsx";
import { NotesScreen } from "#modules/notes/client/Screen.tsx";
import { requireSetup } from "#modules/notes/test-support/requireSetup.ts";
import { screenAuth } from "#modules/notes/test-support/screenAuth.ts";
import { appAuth } from "#test-support/appAuth.ts";
import { acquireScreen } from "#test-support/screenState.ts";
import { notesClient } from "./client.ts";
import type { Screen } from "./screenState.ts";
import { settleQuery } from "./settleQuery.ts";

export const openRoute = Effect.fn("ScreenStory.openRoute")(function* (engine: Screen, route: string, signedIn = true) {
	engine.client.session.signedIn = signedIn;

	const view = yield* acquireScreen(engine);
	if (signedIn) {
		if (route === "/") {
			engine.client.api.list.query();
		} else {
			engine.client.api.get.query({ id: 1 });
		}
		view.registry.mount(engine.client.api[LiveConnection].connection);
		yield* screenDriver({
			act,
			pending: () => view.registry.get(engine.client.api[LiveConnection].status).connection !== "live",
			root: view.container,
			tell: () => undefined,
		}).settle();
	}
	const router = appRouter(
		view.registry,
		connectModules([notesRegistration(engine.client)]),
		screenAuth(),
		createMemoryHistory({ initialEntries: [route] }),
		() => (signedIn ? { user: { id: "alice" } } : undefined),
	);
	engine.router = router;
	yield* Effect.promise(() => view.render(<RouterProvider router={router} />));
	if (signedIn) {
		yield* settleQuery(engine, route === "/" ? "list" : "get");
	}
});

export const openLogin = Effect.fn("ScreenStory.openLogin")(function* (engine: Screen, rejection: string) {
	engine.login.outcome = rejection;
	const auth: AuthActions = {
		signOut: authAction<void, unknown, never>(() => Promise.resolve({ data: {}, error: null })),
		submit: authAction(({ mode, credentials }: { mode: "sign-in" | "sign-up"; credentials: Credentials }) => {
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
	};
	const view = yield* acquireScreen(engine);
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
	const view = yield* acquireScreen(engine);
	const history = createMemoryHistory({ initialEntries: [route] });
	yield* Effect.promise(() =>
		view.render(<App auth={fixture.auth} connect={() => connectModules([notesRegistration(engine.client)])} history={history} />),
	);
	const session = fixture.auth.client.$store.atoms.session;
	yield* requireSetup(session !== undefined, "The auth client has no session atom");
	yield* screenDriver({ act, pending: () => session?.get().isPending ?? false, root: view.container, tell: () => undefined }).settle();
});

export const openNotes = Effect.fn("ScreenStory.openNotes")(function* (engine: Screen, signOutFailure?: string) {
	const view = yield* acquireScreen(engine);
	const signOut =
		signOutFailure === undefined
			? undefined
			: authAction(() => {
					engine.signOutCalls.push(undefined);
					return Promise.resolve({
						data: null,
						error: { message: signOutFailure, status: HttpStatus.fromLiteral("BadRequest"), statusText: "Bad Request" },
					});
				});
	engine.client.api.list.query();
	view.registry.mount(engine.client.api[LiveConnection].connection);
	yield* screenDriver({
		act,
		pending: () => view.registry.get(engine.client.api[LiveConnection].status).connection !== "live",
		root: view.container,
		tell: () => undefined,
	}).settle();
	const loaded = yield* Effect.promise(() => loadQuery(view.registry, engine.client.api.list.query(), { abortController: new AbortController() }));
	yield* Effect.promise(() => view.render(<NotesScreen client={engine.client} loaded={loaded} {...(signOut === undefined ? {} : { signOut })} />));
	yield* settleQuery(engine, "list");
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
		await view.render(
			<SessionApp
				auth={auth}
				connect={(session) => connectModules([notesRegistration(connection(session))])}
				history={history}
				recheck={recheck}
				session={{ user: { id } }}
				userId={id}
			/>,
		);
	}
	engine.switchSession = switchSession;
	yield* Effect.promise(() => switchSession("alice"));
	yield* settleQuery(engine, "list");
});

export const openCodePreview = Effect.fn("ScreenStory.openCodePreview")(function* (engine: Screen, lines: readonly CodePreviewLine[]) {
	const view = yield* acquireScreen(engine);
	yield* Effect.promise(() => view.render(<CodePreview label="Note changes" lines={lines} />));
});
