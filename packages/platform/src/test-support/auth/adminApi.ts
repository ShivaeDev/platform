import { Effect, Schema, Stream } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { Rpc, RpcGroup } from "effect/rpc";
import { SessionUser } from "#rpc/identity.ts";
import { AuthenticatedAdmin, AuthenticatedOwner } from "#rpc/middleware.ts";
import { requireAdmin } from "#rpc/requireAdmin.ts";
import { type SessionPolicy, type UserSessionShape, withSessionUser } from "#server/rpc-server/session.ts";

export const AdminApi = RpcGroup.make(
	Rpc.make("adminTools", { success: Schema.String }).middleware(AuthenticatedAdmin),
	Rpc.make("adminFeed", { stream: true, success: Schema.String }).middleware(AuthenticatedAdmin),
	Rpc.make("ownerTools", { success: Schema.String }).middleware(AuthenticatedOwner),
);
export const adminHandlers = AdminApi.toLayer({
	adminFeed: () => Stream.concat(Stream.fromEffect(Effect.map(SessionUser, (user) => `Admin feed for ${user.email}`)), Stream.never),
	adminTools: () => Effect.map(SessionUser, (user) => `Admin tools for ${user.email}`),
	ownerTools: () => Effect.map(SessionUser, (user) => `Owner tools for ${user.email}`),
});

const routeErrors = {
	AuthUnavailable: () => Effect.succeed(HttpServerResponse.empty({ status: 503 })),
	Forbidden: () => Effect.succeed(HttpServerResponse.empty({ status: 403 })),
	Unauthorized: () => Effect.succeed(HttpServerResponse.empty({ status: 401 })),
};

export function adminRoutes(sessions: SessionPolicy<UserSessionShape>) {
	return HttpRouter.use((router) =>
		Effect.all([
			router.add("GET", "/admin-tools", (request) =>
				Effect.map(requireAdmin, (user) => `Admin tools for ${user.email}`).pipe(
					withSessionUser(sessions, request.headers, "admin-tools"),
					Effect.map(HttpServerResponse.text),
					Effect.catchTags(routeErrors),
				),
			),
			router.add("GET", "/profile", (request) =>
				SessionUser.pipe(
					withSessionUser(sessions, request.headers, "profile"),
					Effect.map(HttpServerResponse.jsonUnsafe),
					Effect.catchTags(routeErrors),
				),
			),
		]),
	);
}
