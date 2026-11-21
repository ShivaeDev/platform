import { createRoute } from "@tanstack/react-router";
import { expectTypeOf } from "vitest";
import { type AdminNavigation, clientModule, type RootRoute } from "@shivaedev/react/client/module.ts";
import type { rootRoute } from "#client/rootRoute.ts";

expectTypeOf<RootRoute>().toEqualTypeOf<ReturnType<typeof rootRoute>>();

clientModule({}, () => ({
	routes: (root) => [
		createRoute({
			beforeLoad: ({ context }) => {
				expectTypeOf(context.adminPages).toEqualTypeOf<readonly AdminNavigation[]>();
			},
			getParentRoute: () => root,
			path: "/typed-root",
		}),
	],
}));
