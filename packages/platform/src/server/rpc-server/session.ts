import { Effect, Layer, Option } from "effect";
import type { Headers } from "effect/http";
import { type AuthUnavailable, Forbidden, Unauthorized } from "#errors/taxonomy.ts";
import { Identity, OptionalIdentity, SessionUser, type SessionUserValue } from "#rpc/identity.ts";
import { Authenticated, AuthenticatedUser, MaybeAuthenticated } from "#rpc/middleware.ts";
import { type OriginPolicy, originRequest } from "./origin.ts";
import { transportHeaders } from "./transportHeaders.ts";
export interface SessionShape {
	readonly user: {
		readonly id: string;
	};
}
export interface SessionProvider<TSession extends SessionShape> {
	readonly get: (headers: Headers.Headers) => Effect.Effect<Option.Option<TSession>, AuthUnavailable>;
}
export interface SessionPolicy<TSession extends SessionShape> {
	readonly origin: OriginPolicy;
	readonly provider: SessionProvider<TSession>;
}
export const resolveSession: <TSession extends SessionShape>(
	policy: SessionPolicy<TSession>,
	headers: Headers.Headers,
	rpc: string,
) => Effect.Effect<Option.Option<TSession>, AuthUnavailable | Forbidden> = Effect.fn("PlatformRpc.resolveSession")(function* <
	TSession extends SessionShape,
>(policy: SessionPolicy<TSession>, headers: Headers.Headers, rpc: string) {
	const transport = yield* transportHeaders(headers);
	if (!policy.origin(originRequest(transport, rpc))) {
		return yield* new Forbidden({ message: "Origin not allowed" });
	}
	return yield* policy.provider.get(transport);
});
function identified(id: string) {
	return Effect.andThen(Effect.annotateCurrentSpan("user.id", id), Effect.succeed(id));
}
export function authenticatedLayer<TSession extends SessionShape>(policy: SessionPolicy<TSession>): Layer.Layer<Authenticated> {
	return Layer.succeed(Authenticated, (effect, { headers, rpc }) =>
		Effect.gen(function* () {
			const session = yield* resolveSession(policy, headers, rpc._tag);
			if (Option.isNone(session)) {
				return yield* new Unauthorized({ message: "Authentication required" });
			}
			const id = yield* identified(session.value.user.id);
			return yield* effect.pipe(Effect.provideService(Identity, { id }), Effect.annotateLogs({ userId: id }));
		}),
	);
}
export function maybeAuthenticatedLayer<TSession extends SessionShape>(policy: SessionPolicy<TSession>): Layer.Layer<MaybeAuthenticated> {
	return Layer.succeed(MaybeAuthenticated, (effect, { headers, rpc }) =>
		Effect.gen(function* () {
			const session = yield* resolveSession(policy, headers, rpc._tag);
			if (Option.isNone(session)) {
				return yield* Effect.provideService(effect, OptionalIdentity, Option.none());
			}
			const id = yield* identified(session.value.user.id);
			return yield* effect.pipe(Effect.provideService(OptionalIdentity, Option.some({ id })), Effect.annotateLogs({ userId: id }));
		}),
	);
}
export interface UserSessionShape extends SessionShape {
	readonly user: SessionUserValue;
}
export function authenticatedUserLayer<TSession extends UserSessionShape>(policy: SessionPolicy<TSession>): Layer.Layer<AuthenticatedUser> {
	return Layer.succeed(AuthenticatedUser, (effect, { headers, rpc }) =>
		Effect.gen(function* () {
			const session = yield* resolveSession(policy, headers, rpc._tag);
			if (Option.isNone(session)) {
				return yield* new Unauthorized({ message: "Authentication required" });
			}
			const { name, email } = session.value.user;
			const id = yield* identified(session.value.user.id);
			return yield* effect.pipe(
				Effect.provideService(Identity, { id }),
				Effect.provideService(SessionUser, { email, id, name }),
				Effect.annotateLogs({ userId: id }),
			);
		}),
	);
}
