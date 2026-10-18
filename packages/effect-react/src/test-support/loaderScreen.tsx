import { RegistryContext } from "@effect/atom-react";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider, useRouterState } from "@tanstack/react-router";
import { Effect } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act, type ReactNode, useContext, useState } from "react";
import { screenDriver } from "@shivaedev/test-story/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { expectNoReactWarnings, render } from "#client/testing.ts";
import { useLoaderQuery } from "#client/useLoaderQuery.ts";
import { loadQuery } from "#loadQuery.ts";
import { loaderHost } from "./loaderHost.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

export const loaderScreen = storyKit({
	clock: "live",
	*create() {
		const host = yield* loaderHost();
		const view = yield* Effect.acquireRelease(
			Effect.promise(() => render(null)),
			(mounted) => Effect.promise(mounted.unmount),
		);
		const loaded = Promise.withResolvers<void>();
		const renders: string[] = [];
		let registry: AtomRegistry.AtomRegistry | undefined;
		let refreshing = false;
		function Shell({ children }: { readonly children: ReactNode }) {
			const pending = useRouterState({ select: (state) => state.isLoading });
			return (
				<main>
					<output data-pending>{String(pending)}</output>
					{children}
				</main>
			);
		}
		const root = createRootRoute();
		const note = createRoute({
			component: () => {
				const query = useLoaderQuery(host.atom, note.useLoaderData());
				renders.push(query.data.title);
				refreshing = query.pending;
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
				if (!registry) {
					throw new Error("No session registry");
				}
				const row = await loadQuery(registry, host.atom, { abortController });
				loaded.resolve();
				await new Promise<void>((resolve) => setTimeout(resolve, 650));
				return row;
			},
			path: "/note",
		});
		const away = createRoute({ component: () => <h1>Other screen</h1>, getParentRoute: () => root, path: "/" });
		const router = createRouter({
			defaultPendingMs: Number.POSITIVE_INFINITY,
			history: createMemoryHistory({ initialEntries: ["/note"] }),
			InnerWrap: Shell,
			routeTree: root.addChildren([note, away]),
		});
		function Routed() {
			registry = useContext(RegistryContext);
			return <RouterProvider router={router} />;
		}
		function App() {
			const [session] = useState("alice");
			return (
				<SessionBoundary connect={() => host} identify={(id) => id} recheck={() => undefined} session={session}>
					{() => <Routed />}
				</SessionBoundary>
			);
		}
		yield* Effect.promise(() => view.render(<App />));
		return {
			host,
			loaded,
			refreshing: () => refreshing,
			registry: () => {
				if (!registry) {
					throw new Error("No session registry");
				}
				return registry;
			},
			renders,
			router,
			view,
		};
	},
	inspect: ({ host, renders, view }) => ({ calls: host.calls, renders, screen: view.container.textContent }),
	name: "loader handoff screen",
	stages: ["screen"],
	verbs: ({ host, loaded, registry, renders, router, view, refreshing }, story) => ({
		...screenDriver({
			act: async (action) => {
				await act(action);
			},
			pending: () => router.state.isLoading || refreshing(),
			root: view.container,
			tell: story.tell,
		}),
		calls: () => host.calls,
		firstRenders: () => renders,
		hasQuery: () => registry().getNodes().has(host.atom),
		hasSource: () => registry().getNodes().has(host.source),
		idle: () =>
			Effect.promise(async () => {
				story.tell("let the registry's idle window expire");
				await act(async () => new Promise<void>((resolve) => setTimeout(resolve, 850)));
			}),
		leave: () =>
			Effect.promise(async () => {
				story.tell("leave the unread route");
				await act(async () => {
					await router.navigate({ to: "/" });
				});
			}),
		loaded: () =>
			Effect.promise(async () => {
				story.tell("wait for the loader result before the delayed mount");
				await act(async () => loaded.promise);
			}),
		next: () =>
			Effect.sync(() => {
				story.tell("hold the next response");
				host.next();
			}),
		respond: (title: string) =>
			Effect.promise(async () => {
				story.tell(`the server responds: ${title}`);
				await act(async () => host.respond(title));
			}),
	}),
});
