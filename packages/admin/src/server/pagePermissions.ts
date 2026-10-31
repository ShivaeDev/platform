import { Context, Effect, Layer, Option } from "effect";
import type { RpcMiddleware } from "effect/rpc";
import type { Identity, SessionUser } from "@shivaedev/identity/identity.ts";
import type { IdentityFailures } from "@shivaedev/identity/middleware.ts";
import { permissionLayer } from "@shivaedev/identity/server/permissions.ts";
import type { AnyAdminRegistry } from "#registry.ts";
import { AdminSessions } from "./AdminSessions.ts";

export function pagePermissions(registry: AnyAdminRegistry) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const context = yield* Effect.context<AdminSessions>();
			const sessions = Context.getOption(context, AdminSessions);
			if (Option.isNone(sessions)) {
				const page = registry.pages[0];
				return yield* Effect.die(
					new Error(`Missing admin permission policy: page ${page?.id}, permission ${page?.route.permission.name}; provide AdminSessions`),
				);
			}
			return Layer.mergeAll(
				Layer.empty,
				...registry.pages.map((page) => {
					const middleware = Context.Service<unknown, RpcMiddleware.RpcMiddleware<Identity | SessionUser, IdentityFailures, never>>(
						page.permissionKey,
					);
					return permissionLayer(Object.assign(middleware, { permission: page.route.permission }), sessions.value);
				}),
			);
		}),
	);
}
