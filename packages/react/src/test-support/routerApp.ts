import { createMemoryHistory, createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
import { Effect, Option, Schema } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { queryRoute } from "#queryRoute.ts";
import type { routerClient } from "./routerClient.ts";
import { RouterFailure, RouterNote, RouterNotFound, RouterPending, RouterShell, SharedNotFound } from "./routerScreens.tsx";

const root = createRootRouteWithContext<{
	readonly client: ReturnType<typeof routerClient>;
	readonly viewerPage: number;
	readonly frames: string[];
	readonly registry: AtomRegistry.AtomRegistry;
}>()({ beforeLoad: ({ context }) => ({ viewer: { page: context.viewerPage } }), component: RouterShell, notFoundComponent: SharedNotFound });

export const RouterSearch = Schema.Struct({
	page: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)).pipe(
		Schema.catchDecoding(() => Effect.succeed(Option.some(1))),
		Schema.withDecodingDefaultKey(Effect.succeed(1)),
	),
});

function noteRoute() {
	return createRoute({
		component: RouterNote,
		errorComponent: RouterFailure,
		getParentRoute: () => root,
		...queryRoute(
			({ context, params, search }: { context: typeof root.types.allContext; params: { id: string }; search: typeof RouterSearch.Type }) =>
				context.client.api.get.query({ ...params, page: search.page * context.viewer.page }),
		),
		path: "/notes/$id",
		validateSearch: Schema.toStandardSchemaV1(RouterSearch),
	});
}

const customNotFoundRoute = createRoute({
	getParentRoute: () => root,
	...queryRoute(({ context, params }: { context: typeof root.types.allContext; params: { id: string }; search: object }) =>
		context.client.api.get.query({ id: params.id, page: 1 }),
	),
	notFoundComponent: RouterNotFound,
	path: "/custom-notes/$id",
});

export function routerApp(registry: AtomRegistry.AtomRegistry, client: ReturnType<typeof routerClient>, initial = "/notes/first", page = 1) {
	return createRouter({
		context: { client, frames: client.frames, registry, viewerPage: page },
		defaultPendingComponent: RouterPending,
		defaultPendingMs: Number.POSITIVE_INFINITY,
		history: createMemoryHistory({ initialEntries: [initial] }),
		routeTree: root.addChildren([noteRoute(), customNotFoundRoute]),
	});
}
