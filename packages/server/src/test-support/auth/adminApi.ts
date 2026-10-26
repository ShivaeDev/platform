import { Effect, Schema, Stream } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { Rpc, RpcGroup } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { AuthUnavailable, Forbidden, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { Identity, SessionUser } from "@shivaedev/identity/identity.ts";
import { AuthenticatedUser } from "@shivaedev/identity/middleware.ts";
import { permissionRoute } from "@shivaedev/identity/server/permissions.ts";
import { type SessionPolicy, type UserSessionShape, withSessionUser } from "@shivaedev/identity/server/session.ts";
import { ManagementPermission, TestRoles, ToolsPermission, UseTools } from "@shivaedev/identity/test-support/auth/permissions.ts";

export const AdminApi = RpcGroup.make(
	Rpc.make("readRecord", {
		error: Schema.Union([Forbidden, Unauthorized, AuthUnavailable]),
		payload: { id: Schema.String },
		success: Schema.String,
	}).middleware(AuthenticatedUser),
	Rpc.make("adminTools", { success: Schema.String }).middleware(ToolsPermission),
	Rpc.make("adminFeed", { stream: true, success: Schema.String }).middleware(ToolsPermission),
	Rpc.make("ownerTools", { success: Schema.String }).middleware(ManagementPermission),
);
export function adminHandlers(state: { handlerRequests: string[] }) {
	return AdminApi.toLayer({
		adminFeed: () => Stream.concat(Stream.fromEffect(Effect.map(SessionUser, (user) => `Admin feed for ${user.email}`)), Stream.never),
		adminTools: () =>
			Effect.map(SessionUser, (user) => {
				state.handlerRequests.push("adminTools");
				return `Admin tools for ${user.email}`;
			}),
		ownerTools: () => Effect.map(SessionUser, (user) => `Owner tools for ${user.email}`),
		readRecord: ({ id }) =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const [record] = yield* sql<{
					id: string;
				}>`select id from members where id = ${id}`.pipe(Effect.orDie);
				if (record === undefined) {
					return yield* Effect.die("Missing record fixture");
				}
				const user = yield* SessionUser;
				const { role } = yield* TestRoles.resolve(user.role).pipe(Effect.mapError(() => new AuthUnavailable({ message: "Unknown role" })));
				yield* TestRoles.requireAccess({ id: user.id, role }, UseTools, record.id);
				return record.id;
			}),
	});
}

const routeErrors = {
	AuthUnavailable: () => Effect.succeed(HttpServerResponse.empty({ status: 503 })),
	Forbidden: () => Effect.succeed(HttpServerResponse.empty({ status: 403 })),
	Unauthorized: () => Effect.succeed(HttpServerResponse.empty({ status: 401 })),
};

export function adminRoutes(sessions: SessionPolicy<UserSessionShape>, state: { handlerRequests: string[] }) {
	const guarded = permissionRoute(sessions, UseTools);
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
