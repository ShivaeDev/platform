import { createMemoryHistory, createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
import { Effect, Option, Schema } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { queryRoute } from "#queryRoute.ts";
import type { routerClient } from "./routerClient.ts";
import { RouterFailure, RouterNote, RouterNotFound, RouterPending, RouterShell } from "./routerScreens.tsx";

const root = createRootRouteWithContext<{
	readonly api: ReturnType<typeof routerClient>["api"];
	readonly frames: string[];
	readonly registry: AtomRegistry.AtomRegistry;
}>()({ component: RouterShell });

export const RouterSearch = Schema.Struct({
	page: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)).pipe(
		Schema.catchDecoding(() => Effect.succeed(Option.some(1))),
		Schema.withDecodingDefaultKey(Effect.succeed(1)),
	),
});

function noteRoute(client: ReturnType<typeof routerClient>) {
	return createRoute({
		component: RouterNote,
		errorComponent: RouterFailure,
		getParentRoute: () => root,
		...queryRoute(({ params, search }: { params: { id: string }; search: typeof RouterSearch.Type }) =>
			client.api.get.query({ ...params, ...search }),
		),
		notFoundComponent: RouterNotFound,
		path: "/notes/$id",
		validateSearch: Schema.toStandardSchemaV1(RouterSearch),
	});
}

export function routerApp(registry: AtomRegistry.AtomRegistry, client: ReturnType<typeof routerClient>, initial = "/notes/first") {
	return createRouter({
		context: { api: client.api, frames: client.frames, registry },
		defaultPendingComponent: RouterPending,
		defaultPendingMs: Number.POSITIVE_INFINITY,
		history: createMemoryHistory({ initialEntries: [initial] }),
		routeTree: root.addChildren([noteRoute(client)]),
	});
}
