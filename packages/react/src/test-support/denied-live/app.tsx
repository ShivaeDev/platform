import { createMemoryHistory, createRootRouteWithContext, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import type { Effect } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { queryRoute } from "#queryRoute.ts";
import type { deniedLiveClient } from "./client.ts";
import { Note } from "./Note.tsx";

type Client = Effect.Success<typeof deniedLiveClient>;
const root = createRootRouteWithContext<{ readonly client: Client; readonly registry: AtomRegistry.AtomRegistry }>()({ component: Outlet });
function loadNote(suffix: string) {
	return queryRoute(
		({ context, params }: { readonly params: { readonly id: string }; readonly search: object; readonly context: typeof root.types.allContext }) =>
			context.client.api.get.query({ id: `${params.id}${suffix}` }),
	);
}
const note = loadNote("");
const details = loadNote("-details");
const counts = loadNote("-counts");
const route = createRoute({
	component: Note,
	getParentRoute: () => root,
	...note,
	loader: async (context: Parameters<typeof note.loader>[0]) => {
		const [loadedNote, loadedDetails, loadedCounts] = await Promise.all([note.loader(context), details.loader(context), counts.loader(context)]);
		return { counts: loadedCounts, details: loadedDetails, note: loadedNote };
	},

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
