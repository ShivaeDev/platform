import { type AnyRouter, createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import { expectNoReactWarnings, type Rendered, render } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { useLoaderQuery } from "#client/useLoaderQuery.ts";
import { loadQuery } from "#loadQuery.ts";
import { loaderHost } from "./loaderHost.ts";
import { NoteShell } from "./NoteShell.tsx";
import { SessionRegistry } from "./SessionRegistry.tsx";
import { settleScreen } from "./settleScreen.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

type Host = Effect.Success<ReturnType<typeof loaderHost>>;

interface Engine {
	readonly host: Host;
	readonly loaded: PromiseWithResolvers<void>;
	readonly mountGate: { wait: (registry: AtomRegistry.AtomRegistry) => Promise<void> };
	refreshing: boolean;
	registry?: AtomRegistry.AtomRegistry;
	readonly renders: string[];
	router?: AnyRouter;
	view?: Rendered;
}

function sessionRegistry(engine: Engine) {
	if (engine.registry === undefined) {
		throw new Error("No session registry");
	}
	return engine.registry;
}

function opened(engine: Engine) {
	if (engine.view === undefined || engine.router === undefined) {
		throw new Error("The note screen is not open");
	}
	return { router: engine.router, view: engine.view };
}

function removed(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<unknown>) {
	return new Promise<void>((resolve) => {
		const before = registry.onNodeRemoved;
		registry.onNodeRemoved = (node) => {
			before?.(node);
			if (node.atom === atom) {
				registry.onNodeRemoved = before;
				resolve();
			}
		};
	});
}

function idleWindowPasses(registry: AtomRegistry.AtomRegistry) {
	const sentinel = Atom.make(0);
	const swept = removed(registry, sentinel);
	registry.get(sentinel);
	return swept;
}

function settle(engine: Engine, tell: (line: string) => void) {
	const { router, view } = opened(engine);
	return settleScreen(
		view.container,
		() => router.state.isLoading || router.state.matches.some((match) => match.isFetching) || engine.refreshing,
		tell,
	);
}

function remember(engine: Engine, registry: AtomRegistry.AtomRegistry) {
	engine.registry = registry;
}

const openNote = Effect.fn("LoaderScreen.openNote")(function* (engine: Engine) {
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
			engine.refreshing = query.pending;
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
});

export const loaderScreen = storyKit({
	clock: "live",
	*create() {
		const host = yield* loaderHost();
		const engine: Engine = {
			host,
			loaded: Promise.withResolvers<void>(),
			mountGate: { wait: () => Promise.resolve() },
			refreshing: false,
			renders: [],
		};
		return engine;
	},
	inspect: (engine) => ({ calls: engine.host.calls, renders: engine.renders, screen: engine.view?.container.textContent }),
	name: "loader handoff screen",
	stages: ["screen"],
	verbs: (engine, story) => {
		const { host } = engine;
		function presence(atom: Atom.Atom<unknown>) {
			return sessionRegistry(engine).getNodes().has(atom) ? "held" : "released";
		}
		return {
			clickLink: (target: "Home" | "Note") =>
				Effect.promise(async () => {
					story.tell(`click the ${target} link`);
					const link = [...opened(engine).view.container.querySelectorAll("a")].find((candidate) => candidate.textContent === target);
					if (link === undefined) {
						throw new Error(`Missing ${target} link`);
					}
					await act(async () => link.click());
				}).pipe(Effect.andThen(settle(engine, story.tell))),
			firstRenders: () => Effect.sync(() => [...engine.renders]),
			idleWindowPasses: () =>
				Effect.promise(async () => {
					story.tell("the session registry's idle window passes, shown by an idle atom being swept");
					await act(() => idleWindowPasses(sessionRegistry(engine)));
				}),
			leave: () =>
				Effect.promise(async () => {
					story.tell("leave the note before it renders");
					await act(async () => {
						await opened(engine).router.navigate({ to: "/" });
					});
				}),
			loaderSource: () => Effect.sync(() => presence(host.source)),
			refresh: () =>
				Effect.promise(async () => {
					story.tell("click Refresh while the server holds its answer");
					host.next();
					const button = opened(engine).view.container.querySelector("button");
					if (button === null) {
						throw new Error("Missing Refresh button");
					}
					await act(async () => button.click());
				}),
			rename: (title: string) =>
				Effect.promise(async () => {
					story.tell(`rename the note to ${title}, which invalidates it`);
					await act(async () => {
						await Effect.runPromise(AtomRegistry.getResult(sessionRegistry(engine), host.rename(title)));
					});
				}),
			respond: (title: string) => respond(engine, title, story.tell),
			serverCalls: () => Effect.sync(() => [...host.calls]),
			shownTitle: () => Effect.sync(() => opened(engine).view.container.querySelector("h1")?.textContent),
		};
	},
});

function respond(engine: Engine, title: string, tell: (line: string) => void) {
	return Effect.promise(async () => {
		tell(`the server answers ${title}`);
		await act(async () => engine.host.respond(title));
	}).pipe(Effect.andThen(settle(engine, tell)));
}

export function noteShown(title: string) {
	return loaderScreen.trait("screen", `the note route loaded and shows ${title}`, function* (engine) {
		yield* openNote(engine);
		yield* respond(engine, title, () => undefined);
	});
}

export function noteMountedAfterIdleWindow(title: string) {
	return loaderScreen.trait(
		"screen",
		`the note's loader read ${title} and the route mounted only after the session registry's idle window passed`,
		function* (engine) {
			engine.mountGate.wait = idleWindowPasses;
			yield* openNote(engine);
			yield* respond(engine, title, () => undefined);
		},
	);
}

export function noteLoadedButNotMounted(title: string) {
	return loaderScreen.trait("screen", `the note's loader read ${title} and its route has not mounted yet`, function* (engine) {
		engine.mountGate.wait = () => new Promise<void>(() => undefined);
		yield* openNote(engine);
		yield* Effect.promise(async () => {
			await act(async () => engine.host.respond(title));
			await act(() => engine.loaded.promise);
		});
	});
}

export function noteLeftAfterShowing(title: string) {
	return loaderScreen.trait(
		"screen",
		`the note route showed ${title}, then the Home link left it and its query wrapper was swept`,
		function* (engine) {
			yield* openNote(engine);
			yield* respond(engine, title, () => undefined);
			const { view } = opened(engine);
			const home = [...view.container.querySelectorAll("a")].find((candidate) => candidate.textContent === "Home");
			const registry = sessionRegistry(engine);
			const swept = removed(registry, engine.host.atom);
			yield* Effect.promise(async () => {
				await act(async () => home?.click());
				await act(() => swept);
			});
			yield* settle(engine, () => undefined);
		},
	);
}
