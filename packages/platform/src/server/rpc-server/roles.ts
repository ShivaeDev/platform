import { Effect, Layer, Option } from "effect";
import { type HttpServerRequest, HttpServerResponse } from "effect/http";
import type { RpcMiddleware } from "effect/rpc";
import { type AuthUnavailable, Forbidden, type Unauthorized } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { hasRole } from "#rpc/hasRole.ts";
import { Identity, SessionUser, type SessionUserValue } from "#rpc/identity.ts";
import { AuthenticatedAdmin, AuthenticatedOwner } from "#rpc/middleware.ts";
import { requireAdmin } from "#rpc/requireAdmin.ts";
import { sessionCommandChanges } from "#server/commandChanges.ts";
import { revalidateStream } from "./revalidateStream.ts";
import { resolveSession, type SessionPolicy, type UserSessionShape, withSessionUser } from "./session.ts";

function requiringRole<TSession extends UserSessionShape>(
	policy: SessionPolicy<TSession>,
	role: string,
	message: string,
): RpcMiddleware.RpcMiddleware<Identity | SessionUser, Unauthorized | AuthUnavailable | Forbidden, never> {
	function permitted(user: SessionUserValue) {
		return hasRole(user, role) ? Effect.void : Effect.fail(new Forbidden({ message }));
	}
	return (effect, { headers, rpc, payload }) => {
		const lookup = Effect.tap(resolveSession(policy, headers, rpc._tag), (session) =>
			Option.isSome(session) ? permitted(session.value.user) : Effect.void,
		);
		return sessionCommandChanges(effect, rpc, payload).pipe(
			(invocation) => Effect.flatMap(Identity, ({ id }) => invocation.pipe(revalidateStream(policy, rpc, id, lookup))),
			(invocation) => Effect.andThen(Effect.flatMap(SessionUser, permitted), invocation),
			withSessionUser(policy, headers, rpc._tag),
		);
	};
}
export function authenticatedAdminLayer<TSession extends UserSessionShape>(policy: SessionPolicy<TSession>): Layer.Layer<AuthenticatedAdmin> {
	return Layer.succeed(AuthenticatedAdmin, requiringRole(policy, "admin", "Administrator role required"));
}
function adminRejection(error: Unauthorized | Forbidden | AuthUnavailable) {
	return HttpServerResponse.empty({
		headers: { "cache-control": "private, no-store" },
		status: { AuthUnavailable: 503, Forbidden: 403, Unauthorized: 401 }[error._tag],
	});
}

export function adminRoute<TSession extends UserSessionShape>(policy: SessionPolicy<TSession>) {
	return <E, R>(handler: (request: HttpServerRequest.HttpServerRequest) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
		(request: HttpServerRequest.HttpServerRequest): Effect.Effect<HttpServerResponse.HttpServerResponse, E, Exclude<R, Identity | SessionUser>> =>
			Effect.andThen(requireAdmin, Effect.context<Identity | SessionUser>()).pipe(
				withSessionUser(policy, request.headers, request.url),
				Effect.matchEffect({
					onFailure: (error) => Effect.succeed(adminRejection(error)),
					onSuccess: (context) => Effect.provideContext(handler(request), context),
				}),
			);
}
export function authenticatedOwnerLayer<TSession extends UserSessionShape>(policy: SessionPolicy<TSession>): Layer.Layer<AuthenticatedOwner> {
	return Layer.succeed(AuthenticatedOwner, requiringRole(policy, "owner", "Owner role required"));
}
