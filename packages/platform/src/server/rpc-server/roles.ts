import { Effect, Layer, Option } from "effect";
import type { RpcMiddleware } from "effect/rpc";
import { type AuthUnavailable, Forbidden, type Unauthorized } from "#errors/taxonomy.ts";
import { hasRole } from "#rpc/hasRole.ts";
import { Identity, SessionUser, type SessionUserValue } from "#rpc/identity.ts";
import { AuthenticatedAdmin, AuthenticatedOwner } from "#rpc/middleware.ts";
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
export function authenticatedOwnerLayer<TSession extends UserSessionShape>(policy: SessionPolicy<TSession>): Layer.Layer<AuthenticatedOwner> {
	return Layer.succeed(AuthenticatedOwner, requiringRole(policy, "owner", "Owner role required"));
}
