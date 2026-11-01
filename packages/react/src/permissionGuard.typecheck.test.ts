import { createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
import { expectTypeOf } from "vitest";
import { permission } from "@shivaedev/access/permission.ts";
import { permissionGuard } from "./permissionGuard.ts";
import type { PermissionSession } from "./permissions.ts";

const root = createRootRouteWithContext<{ readonly session: () => PermissionSession | null }>()({
	beforeLoad: ({ context, ...route }) => permissionGuard({ session: context.session, signIn: "/login" })(route),
});
const note = createRoute({
	getParentRoute: () => root,
	loader: ({ params }) => ({ id: params.id }),
	path: "/notes/$id",
	staticData: { permission: permission("notes.read") },
});
export const router = createRouter({ context: { session: () => null }, routeTree: root.addChildren([note]) });
expectTypeOf<typeof note.types.loaderData>().toEqualTypeOf<{ id: string }>();
expectTypeOf<typeof note.types.allParams.id>().toEqualTypeOf<string>();
expectTypeOf<typeof note.types.fullPath>().toEqualTypeOf<"/notes/$id">();
expectTypeOf<typeof root.types.allContext>().toMatchTypeOf<{ readonly session: () => PermissionSession | null }>();
expectTypeOf<typeof root.types.allContext>().not.toBeAny();
