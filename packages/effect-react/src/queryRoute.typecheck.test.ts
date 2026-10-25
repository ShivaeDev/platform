import { createRootRouteWithContext, createRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { expectTypeOf } from "vitest";
import { queryRoute } from "#queryRoute.ts";
import { RouterSearch } from "#test/routerApp.ts";
import { routerClient } from "#test/routerClient.ts";

export function typedQueryRoute() {
	const root = createRootRouteWithContext<{ registry: AtomRegistry.AtomRegistry }>()();
	const client = routerClient();
	const route = createRoute({
		getParentRoute: () => root,
		params: {
			parse: ({ id }) => ({ id: Schema.decodeUnknownSync(Schema.NumberFromString)(id) }),
			stringify: ({ id }: { id: number }) => ({ id: String(id) }),
		},
		path: "/notes/$id",
		validateSearch: Schema.toStandardSchemaV1(RouterSearch),
		...queryRoute(({ params, search }: { params: { id: number }; search: typeof RouterSearch.Type }) => {
			expectTypeOf(params.id).toEqualTypeOf<number>();
			expectTypeOf(search.page).toEqualTypeOf<number>();
			// @ts-expect-error Search validation produces a number, not a string.
			client.api.get.query({ id: String(params.id), page: "1" });
			// @ts-expect-error The query builder has only the declared params.
			expectTypeOf(params.missing);
			return client.api.get.query({ id: String(params.id), page: search.page });
		}),
	});
	expectTypeOf<typeof route.types.loaderData>().toEqualTypeOf<{ readonly id: string; readonly title: string }>();
	expectTypeOf<typeof route.types.fullSearchSchema>().toEqualTypeOf<{ readonly page: number }>();
	expectTypeOf<typeof route.types.allParams>().toEqualTypeOf<{ id: number }>();
	return route;
}
