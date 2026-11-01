import { Context, Layer } from "effect";
import type { RpcMiddleware } from "effect/rpc";
import type { Identity, SessionUser } from "@shivaedev/identity/identity.ts";
import type { IdentityFailures } from "@shivaedev/identity/middleware.ts";
import { permissionLayer } from "@shivaedev/identity/server/permissions.ts";
import type { AnyAdminRegistry } from "#registry.ts";

export function pagePermissions(registry: AnyAdminRegistry) {
	return Layer.mergeAll(
		Layer.empty,
		...registry.pages.map((page) => {
			const middleware = Context.Service<unknown, RpcMiddleware.RpcMiddleware<Identity | SessionUser, IdentityFailures, never>>(page.permissionKey);
			return permissionLayer(Object.assign(middleware, { permission: page.route.permission }));
		}),
	);
}
