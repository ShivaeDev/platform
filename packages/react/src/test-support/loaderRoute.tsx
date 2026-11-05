import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { render } from "@shivaedev/test-story/client/adapters/react.ts";
import { loadQuery } from "#adapters/loadQuery.ts";
import { screenPending } from "#adapters/screenPending.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { useLoaderQuery } from "#client/useLoaderQuery.ts";
import { type Engine, sessionRegistry } from "./loaderScreenState.ts";
import { NoteShell } from "./NoteShell.tsx";
import { SessionRegistry } from "./SessionRegistry.tsx";

function remember(engine: Engine, registry: AtomRegistry.AtomRegistry) {
	engine.registry = registry;
}

export const loaderRoute = Effect.fn("LoaderScreen.loaderRoute")(function* (engine: Engine) {
	const { host } = engine;
	engine.view = yield* Effect.acquireRelease(
		Effect.promise(() => render(null)),
		(mounted) => Effect.promise(mounted.unmount),
	);
	const root = createRootRoute();
	const note = createRoute({
		component: () => {
			const query = useLoaderQuery(host.atom, note.useLoaderData());
			engine.renders.push(query.data.title);
			return (
				<article>
					<h1>{query.data.title}</h1>
					<button onClick={query.refresh} type="button">
						Refresh
					</button>
				</article>
			);
		},
		getParentRoute: () => root,
		loader: async ({ abortController }) => {
			const registry = sessionRegistry(engine);
			const row = await loadQuery(registry, host.atom, { abortController });
			engine.loaded.resolve();
			await engine.mountGate.wait(registry);
			return row;
		},
		path: "/note",
	});
	const away = createRoute({ component: () => <h1>Other screen</h1>, getParentRoute: () => root, path: "/" });
	const router = createRouter({
		defaultPendingMs: Number.POSITIVE_INFINITY,
		history: createMemoryHistory({ initialEntries: ["/note"] }),
		InnerWrap: NoteShell,
		routeTree: root.addChildren([note, away]),
	});
	engine.router = router;
	const view = engine.view;
	yield* Effect.promise(() =>
		view.render(
			<SessionBoundary connect={() => host} identify={(id) => id} recheck={() => undefined} session="alice">
				{() => (
					<>
						<SessionRegistry onRegistry={(found) => remember(engine, found)} />
						<RouterProvider router={router} />
					</>
				)}
			</SessionBoundary>,
		),
	);
	engine.pending = yield* screenPending({ router }).pipe(Effect.provideService(AtomRegistry.AtomRegistry, sessionRegistry(engine)));
});
