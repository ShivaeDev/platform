import { RegistryContext } from "@effect/atom-react";
import { createMemoryHistory, createRootRouteWithContext, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import type { Effect } from "effect";
import type { AtomRegistry } from "effect/reactivity/AtomRegistry";
import { useContext, useState } from "react";
import { queryRoute } from "#client/adapters/queryRoute.ts";
import type { openClient } from "#test/recent-queries/openClient.ts";

type Client = Effect.Success<typeof openClient>["client"];

const root = createRootRouteWithContext<{ readonly client: Client; readonly registry: AtomRegistry }>()();
const noteQuery = queryRoute(({ context, params }: { context: typeof root.types.allContext; params: { id: string }; search: object }) =>
	context.client.api.get.query({ id: params.id }),
);
const note = createRoute({
	component: () => {
		const query = noteQuery.useQuery();
		return (
			<output data-pending={query.pending} data-stale={query.stale}>
				{query.data}
			</output>
		);
	},
	getParentRoute: () => root,
	...noteQuery,
	path: "/notes/$id",
});
const routeTree = root.addChildren([note]);

export function NoteRoute({ client, id }: { readonly client: Client; readonly id: string }) {
	const registry = useContext(RegistryContext);
	const [router] = useState(() =>
		createRouter({
			context: { client, registry },
			defaultPendingMs: Number.POSITIVE_INFINITY,
			history: createMemoryHistory({ initialEntries: [`/notes/${id}`] }),
			routeTree,
		}),
	);
	return <RouterProvider router={router} />;
}
