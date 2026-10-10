import { Effect, Layer, Option } from "effect";
import type { Headers } from "effect/unstable/http";
import { type AuthUnavailable, Forbidden, Unauthorized } from "#errors/taxonomy.ts";
import { Identity, OptionalIdentity } from "#rpc/identity.ts";
import { Authenticated, MaybeAuthenticated } from "#rpc/middleware.ts";
import { type OriginPolicy, originRequest } from "./origin.ts";
import { transportHeaders } from "./transport.ts";

export interface SessionShape {
	readonly user: { readonly id: string };
}

export interface SessionProvider<Session extends SessionShape> {
	readonly get: (headers: Headers.Headers) => Effect.Effect<Option.Option<Session>, AuthUnavailable>;
}

export interface SessionPolicy<Session extends SessionShape> {
	readonly origin: OriginPolicy;
	readonly provider: SessionProvider<Session>;
}

export const resolveSession: <Session extends SessionShape>(
	policy: SessionPolicy<Session>,
	headers: Headers.Headers,
	rpc: string,
) => Effect.Effect<Option.Option<Session>, AuthUnavailable | Forbidden> = Effect.fn("PlatformRpc.resolveSession")(function* <
	Session extends SessionShape,
>(policy: SessionPolicy<Session>, headers: Headers.Headers, rpc: string) {
	const transport = yield* transportHeaders(headers);
	if (!policy.origin(originRequest(transport, rpc))) {
		return yield* new Forbidden({ message: "Origin not allowed" });
	}
	return yield* policy.provider.get(transport);
});

function identified(id: string) {
	return Effect.andThen(Effect.annotateCurrentSpan("user.id", id), Effect.succeed(id));
}

export const authenticatedLayer = <Session extends SessionShape>(policy: SessionPolicy<Session>): Layer.Layer<Authenticated> =>
	Layer.succeed(Authenticated, (effect, { headers, rpc }) =>
		Effect.gen(function* () {
			const session = yield* resolveSession(policy, headers, rpc._tag);
			if (Option.isNone(session)) {
				return yield* new Unauthorized({ message: "Authentication required" });
			}
			const id = yield* identified(session.value.user.id);
			return yield* effect.pipe(Effect.provideService(Identity, { id }), Effect.annotateLogs({ userId: id }));
		}),
	);

export const maybeAuthenticatedLayer = <Session extends SessionShape>(policy: SessionPolicy<Session>): Layer.Layer<MaybeAuthenticated> =>
	Layer.succeed(MaybeAuthenticated, (effect, { headers, rpc }) =>
		Effect.gen(function* () {
			const session = yield* resolveSession(policy, headers, rpc._tag);
			if (Option.isNone(session)) {
				return yield* Effect.provideService(effect, OptionalIdentity, Option.none());
			}
			const id = yield* identified(session.value.user.id);
			return yield* effect.pipe(Effect.provideService(OptionalIdentity, Option.some({ id })), Effect.annotateLogs({ userId: id }));
		}),
	);
