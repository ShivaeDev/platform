import { Effect, Schema } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { Rpc, RpcGroup } from "effect/rpc";
import { Forbidden, Unauthorized } from "#errors/taxonomy.ts";
import { AuthenticatedUser } from "#rpc/middleware.ts";
import { requireAdmin } from "#rpc/requireAdmin.ts";
import { type SessionPolicy, type UserSessionShape, withSessionUser } from "#server/rpc-server/session.ts";

export const AdminApi = RpcGroup.make(Rpc.make("adminTools", { error: Schema.Union([Unauthorized, Forbidden]), success: Schema.String })).middleware(
	AuthenticatedUser,
);
const tools = Effect.map(requireAdmin, (user) => `Admin tools for ${user.email}`);
export const adminHandlers = AdminApi.toLayer({ adminTools: () => tools });

const routeErrors = {
	AuthUnavailable: () => Effect.succeed(HttpServerResponse.empty({ status: 503 })),
	Forbidden: () => Effect.succeed(HttpServerResponse.empty({ status: 403 })),
	Unauthorized: () => Effect.succeed(HttpServerResponse.empty({ status: 401 })),
};

export function adminRoutes(sessions: SessionPolicy<UserSessionShape>) {
	return HttpRouter.use((router) =>
		router.add("GET", "/admin-tools", (request) =>
			tools.pipe(withSessionUser(sessions, request.headers, "admin-tools"), Effect.map(HttpServerResponse.text), Effect.catchTags(routeErrors)),
		),
	);
}
