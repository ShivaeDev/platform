import { createRootRouteWithContext, createRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { expectTypeOf } from "vitest";
import { queryRoute } from "#queryRoute.ts";
import { RouterSearch } from "#test/routerApp.ts";
import type { routerClient } from "#test/routerClient.ts";

export function typedQueryRoute() {
	const root = createRootRouteWithContext<{
		registry: AtomRegistry.AtomRegistry;
		client: ReturnType<typeof routerClient>;
		viewer: { id: string };
	}>()();
	const route = createRoute({
		getParentRoute: () => root,
		params: {
			parse: ({ id }) => ({ id: Schema.decodeUnknownSync(Schema.NumberFromString)(id) }),
			stringify: ({ id }: { id: number }) => ({ id: String(id) }),
		},
		path: "/notes/$id",
		validateSearch: Schema.toStandardSchemaV1(RouterSearch),
		...queryRoute(
			({ context, params, search }: { context: typeof root.types.allContext; params: { id: number }; search: typeof RouterSearch.Type }) => {
				expectTypeOf(context.viewer.id).toEqualTypeOf<string>();
				// @ts-expect-error The router does not declare this context field.
				expectTypeOf(context.session);
				expectTypeOf(params.id).toEqualTypeOf<number>();
				expectTypeOf(search.page).toEqualTypeOf<number>();
				// @ts-expect-error Search validation produces a number, not a string.
				context.client.api.get.query({ id: String(params.id), page: "1" });
				// @ts-expect-error The query builder has only the declared params.
				expectTypeOf(params.missing);
				return context.client.api.get.query({ id: String(params.id), page: search.page });
			},
		),
	});
	expectTypeOf<typeof route.types.loaderData>().toEqualTypeOf<{ readonly id: string; readonly title: string }>();
	expectTypeOf<typeof route.types.fullSearchSchema>().toEqualTypeOf<{ readonly page: number }>();
	expectTypeOf<typeof route.types.allParams>().toEqualTypeOf<{ id: number }>();
	const requiresSession = queryRoute(({ context }: { context: typeof root.types.allContext & { session: string } }) =>
		context.client.api.get.query({ id: context.session, page: 1 }),
	);
	// @ts-expect-error The query factory requires a session the router does not provide.
	createRoute({
		getParentRoute: () => root,
		path: "/session",
		...requiresSession,
	});
	return route;
}
