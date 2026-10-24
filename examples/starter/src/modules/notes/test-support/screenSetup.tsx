import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { LiveConnection } from "@shivaedev/effect-contract/automaticLive.ts";
import { authAction } from "@shivaedev/effect-react/client/authAction.ts";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { loadQuery } from "@shivaedev/effect-react/loadQuery.ts";
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
		yield* Effect.promise(() =>
			eventually(() =>
				requireSetup(view.registry.get(engine.client.api[LiveConnection].status).connection === "live", "The fixture live connection did not open"),
			),
		);
	}
	const router = appRouter(
		view.registry,
		connectModules([notesRegistration(engine.client)]),
		screenAuth(),
		createMemoryHistory({ initialEntries: [route] }),
	);
	engine.router = router;
	yield* Effect.promise(() => view.render(<RouterProvider router={router} />));
	if (signedIn) {
		yield* Effect.promise(() =>
			eventually(() => requireSetup(engine.client.calls.includes(route === "/" ? "list" : "get"), "The route did not load its query")),
		);
	}
});

export const openLogin = Effect.fn("ScreenStory.openLogin")(function* (engine: Screen, rejection: string) {
	engine.login.outcome = rejection;
	const auth: AuthActions = {
		signOut: authAction<void, unknown, never>(() => Promise.resolve({ data: {}, error: null })),
		submit: authAction(({ mode, credentials }: { mode: "sign-in" | "sign-up"; credentials: Credentials }) => {
			engine.login.calls.push({ credentials, mode });
			return engine.login.unavailable
				? Promise.reject(new Error("offline"))
				: Promise.resolve(
						engine.login.outcome === undefined
							? { data: {}, error: null }
							: { data: null, error: { message: engine.login.outcome, status: 401, statusText: "Unauthorized" } },
					);
		}),
	};
	const view = yield* acquireScreen(engine);
	yield* Effect.promise(() =>
		view.render(
			<LoginScreen
				auth={auth}
				onAuthenticated={() => {
					engine.login.authenticated += 1;
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
});

export const openNotes = Effect.fn("ScreenStory.openNotes")(function* (engine: Screen, signOutFailure?: string) {
	const view = yield* acquireScreen(engine);
	const signOut =
		signOutFailure === undefined
			? undefined
			: authAction(() => {
					engine.signOutCalls += 1;
					return Promise.resolve({ data: null, error: { message: signOutFailure, status: 400, statusText: "Bad Request" } });
				});
	engine.client.api.list.query();
	view.registry.mount(engine.client.api[LiveConnection].connection);
	yield* Effect.promise(() =>
		eventually(() =>
			requireSetup(view.registry.get(engine.client.api[LiveConnection].status).connection === "live", "The fixture live connection did not open"),
		),
	);
	const loaded = yield* Effect.promise(() => loadQuery(view.registry, engine.client.api.list.query(), { abortController: new AbortController() }));
	yield* Effect.promise(() => view.render(<NotesScreen client={engine.client} loaded={loaded} {...(signOut === undefined ? {} : { signOut })} />));
	yield* Effect.promise(() => eventually(() => requireSetup(engine.client.calls.includes("list"), "The notes list did not load")));
});

export const openSession = Effect.fn("ScreenStory.openSession")(function* (engine: Screen) {
	const alice = engine.client;
	const bob = notesClient();
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
				sessionId={id}
			/>,
		);
		await eventually(() => requireSetup(engine.client.calls.includes("list"), "The notes list did not load"));
	}
	engine.switchSession = switchSession;
	yield* Effect.promise(() => switchSession("alice"));
});

export const openCodePreview = Effect.fn("ScreenStory.openCodePreview")(function* (engine: Screen, lines: readonly CodePreviewLine[]) {
	const view = yield* acquireScreen(engine);
	yield* Effect.promise(() => view.render(<CodePreview label="Note changes" lines={lines} />));
});
