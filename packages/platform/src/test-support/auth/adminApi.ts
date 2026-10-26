import { Effect, Schema, Stream } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { Rpc, RpcGroup } from "effect/rpc";
import { Forbidden } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { Identity, SessionUser } from "#rpc/identity.ts";
import { AuthenticatedAdmin, AuthenticatedOwner } from "#rpc/middleware.ts";
import { adminRoute } from "#server/rpc-server/roles.ts";
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

export function adminRoutes(sessions: SessionPolicy<UserSessionShape>, state: { handlerRequests: string[] }) {
	const guarded = adminRoute(sessions);
	const tools = guarded((request) =>
		Effect.gen(function* () {
			state.handlerRequests.push(request.method);
			const user = yield* SessionUser;
			const identity = yield* Identity;
			return HttpServerResponse.text(`Admin tools for ${user.email}`, {
				headers: { "x-admin-id": identity.id },
				status: request.method === "POST" ? 201 : 200,
			});
		}),
	);
	return HttpRouter.use((router) =>
		Effect.all([
			router.add("GET", "/admin-tools", tools),
			router.add("POST", "/admin-tools", tools),
			router.add("GET", "/admin-failure", (request) =>
				guarded(() => Effect.fail(new Forbidden({ message: "Handler failure" })))(request).pipe(
					Effect.catchTag("Forbidden", (error) => Effect.succeed(HttpServerResponse.text(error.message, { status: 422 }))),
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
