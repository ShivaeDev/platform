import { createMemoryHistory, createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { loadQuery } from "#loadQuery.ts";
import type { routerClient } from "./routerClient.ts";
import { RouterFailure, RouterNote, RouterPending, RouterShell } from "./routerScreens.tsx";

const root = createRootRouteWithContext<{
	readonly api: ReturnType<typeof routerClient>["api"];
	readonly registry: AtomRegistry.AtomRegistry;
}>()({ component: RouterShell });

const noteRoute = createRoute({
	component: RouterNote,
	errorComponent: RouterFailure,
	getParentRoute: () => root,
	loader: (context) => loadQuery(context.context.registry, context.context.api.get.query(context.params), context),
	path: "/notes/$id",
});

export function routerApp(registry: AtomRegistry.AtomRegistry, client: ReturnType<typeof routerClient>, initial = "/notes/first") {
	return createRouter({
		context: { api: client.api, registry },
		defaultPendingComponent: RouterPending,
		defaultPendingMs: Number.POSITIVE_INFINITY,
		history: createMemoryHistory({ initialEntries: [initial] }),
		routeTree: root.addChildren([noteRoute]),
	});
}
