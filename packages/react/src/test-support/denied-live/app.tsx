import { createMemoryHistory, createRootRouteWithContext, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import type { Effect } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { queryRoute } from "#queryRoute.ts";
import type { deniedLiveClient } from "./client.ts";
import { Note } from "./Note.tsx";

type Client = Effect.Success<typeof deniedLiveClient>;
const root = createRootRouteWithContext<{ readonly client: Client; readonly registry: AtomRegistry.AtomRegistry }>()({ component: Outlet });
const loadNote = queryRoute(
	({ context, params }: { readonly params: { readonly id: string }; readonly search: object; readonly context: typeof root.types.allContext }) =>
		context.client.api.get.query(params),
);
const route = createRoute({
	component: Note,
	getParentRoute: () => root,
	...loadNote,

	notFoundComponent: () => <h1>Note not found</h1>,
	path: "/$id",
});
export function deniedLiveApp(registry: AtomRegistry.AtomRegistry, client: Client, initial = "private") {
	return createRouter({
		context: { client, registry },
		defaultPendingMs: Number.POSITIVE_INFINITY,
		history: createMemoryHistory({ initialEntries: [`/${initial}`] }),
		routeTree: root.addChildren([route]),
	});
}
