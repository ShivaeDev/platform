import { Effect, Layer, Option } from "effect";
import { type HttpServerRequest, HttpServerResponse } from "effect/http";
import type { RpcMiddleware } from "effect/rpc";
import type { Permission } from "@shivaedev/access/permission.ts";
import { type AuthUnavailable, Forbidden, type Unauthorized } from "@shivaedev/contract/errors/taxonomy.ts";
import { Identity, type SessionUser } from "#rpc/identity.ts";
import { hasPermission, type permissionMiddleware, requirePermission } from "#rpc/permission.ts";
import { sessionCommandChanges } from "#server/commandChanges.ts";
import { revalidateStream } from "./revalidateStream.ts";
import { resolveSession, type SessionPolicy, type UserSessionShape, withSessionUser } from "./session.ts";

export function permissionLayer<TMiddleware, TSession extends UserSessionShape>(
	middleware: ReturnType<ReturnType<typeof permissionMiddleware<TMiddleware>>>,
	policy: SessionPolicy<TSession>,
) {
	const permission = middleware.permission;
	const guard: RpcMiddleware.RpcMiddleware<Identity | SessionUser, Unauthorized | AuthUnavailable | Forbidden, never> = (
		effect,
		{ headers, rpc, payload },
	) => {
		const lookup = Effect.tap(resolveSession(policy, headers, rpc._tag), (session) =>
			Option.isSome(session) && !hasPermission(session.value.user, permission)
				? Effect.fail(new Forbidden({ message: `Permission required: ${permission.name} (${permission.strength})` }))
				: Effect.void,
		);
		return sessionCommandChanges(effect, rpc, payload).pipe(
			(invocation) => Effect.flatMap(Identity, ({ id }) => invocation.pipe(revalidateStream(policy, rpc, id, lookup))),
			(invocation) => Effect.andThen(requirePermission(permission), invocation),
			withSessionUser(policy, headers, rpc._tag),
		);
	};
	return Layer.succeed(middleware, guard);
}
function rejection(error: Unauthorized | Forbidden | AuthUnavailable) {
	return HttpServerResponse.empty({
		headers: { "cache-control": "private, no-store" },
		status: { AuthUnavailable: 503, Forbidden: 403, Unauthorized: 401 }[error._tag],
	});
}

export function permissionRoute<TSession extends UserSessionShape>(policy: SessionPolicy<TSession>, permission: Permission) {
	return <E, R>(handler: (request: HttpServerRequest.HttpServerRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
		(request: HttpServerRequest.HttpServerRequest): Effect.Effect<HttpServerResponse.HttpServerResponse, E, Exclude<R, Identity | SessionUser>> =>
			Effect.andThen(requirePermission(permission), Effect.context<Identity | SessionUser>()).pipe(
				withSessionUser(policy, request.headers, request.url),
				Effect.matchEffect({
					onFailure: (error) => Effect.succeed(rejection(error)),
					onSuccess: (context) => Effect.provideContext(handler(request), context),
				}),
			);
}
