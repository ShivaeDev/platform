import { Duration, Effect, Exit, Layer, Option } from "effect";
import type { Headers } from "effect/http";
import type { Permission } from "@shivaedev/access/permission.ts";
import type { RoleSet } from "@shivaedev/access/roleSet.ts";
import { type AuthUnavailable, Forbidden, Unauthorized } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import {
	Identity,
	OptionalIdentity,
	SessionUser,
	type SessionUserValue,
	SessionUserWithProviderAccounts,
	type SessionUserWithProviderAccountsValue,
} from "#rpc/identity.ts";
import { Authenticated, AuthenticatedUser, AuthenticatedUserWithProviderAccounts, MaybeAuthenticated } from "#rpc/middleware.ts";
import { sessionCommandChanges } from "#server/commandChanges.ts";
import { type OriginPolicy, originRequest } from "./origin.ts";
import { resolveRole } from "./resolveRole.ts";
import { revalidateStream } from "./revalidateStream.ts";
import { sessionProfile } from "./sessionProfile.ts";
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
	readonly roles?: RoleSet;
	readonly streamRevalidationInterval?: Duration.Input | undefined;
}
export const resolveSession: <TSession extends SessionShape>(
	policy: SessionPolicy<TSession>,
	headers: Headers.Headers,
	rpc: string,
) => Effect.Effect<Option.Option<TSession & { readonly user: { readonly permissions?: readonly Permission[] } }>, AuthUnavailable | Forbidden> =
	Effect.fn("PlatformRpc.resolveSession")(function* <TSession extends SessionShape>(
		policy: SessionPolicy<TSession>,
		headers: Headers.Headers,
		rpc: string,
	) {
		const transport = yield* transportHeaders(headers);
		if (!policy.origin(originRequest(transport, rpc))) {
			return yield* new Forbidden({ message: "Origin not allowed" });
		}
		const session = yield* policy.provider.get(transport);
		if (Option.isNone(session) || policy.roles === undefined) {
			return session;
		}
		const access = yield* resolveRole(policy.roles, Reflect.get(session.value.user, "role"));
		return Option.some({ ...session.value, user: { ...session.value.user, ...access } });
	});
function identified(id: string) {
	return Effect.andThen(Effect.annotateCurrentSpan("user.id", id), Effect.succeed(id));
}
export function authenticatedLayer<TSession extends SessionShape>(policy: SessionPolicy<TSession>): Layer.Layer<Authenticated> {
	return Layer.succeed(Authenticated, (effect, { headers, rpc, payload }) =>
		Effect.gen(function* () {
			const session = yield* resolveSession(policy, headers, rpc._tag);
			if (Option.isNone(session)) {
				return yield* new Unauthorized({ message: "Authentication required" });
			}
			const id = yield* identified(session.value.user.id);
			return yield* sessionCommandChanges(effect, rpc, payload).pipe(
				revalidateStream(policy, rpc, id, resolveSession(policy, headers, rpc._tag)),
				Effect.provideService(Identity, { id }),
				Effect.annotateLogs({ userId: id }),
			);
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
			return yield* effect.pipe(
				revalidateStream(policy, rpc, id, resolveSession(policy, headers, rpc._tag)),
				Effect.provideService(OptionalIdentity, Option.some({ id })),
				Effect.annotateLogs({ userId: id }),
			);
		}),
	);
}
export interface UserSessionShape extends SessionShape {
	readonly user: SessionUserValue;
}
export function withSessionUser<TSession extends UserSessionShape>(policy: SessionPolicy<TSession>, headers: Headers.Headers, operation: string) {
	return <A, E, R>(effect: Effect.Effect<A, E, R>) =>
		Effect.gen(function* () {
			const session = yield* resolveSession(policy, headers, operation);
			if (Option.isNone(session)) {
				return yield* new Unauthorized({ message: "Authentication required" });
			}
			const user = sessionProfile(session.value.user);
			const id = yield* identified(session.value.user.id);
			return yield* effect.pipe(
				Effect.provideService(Identity, { id }),
				Effect.provideService(SessionUser, user),
				Effect.annotateLogs({ userId: id }),
			);
		});
}
export function authenticatedUserLayer<TSession extends UserSessionShape>(policy: SessionPolicy<TSession>): Layer.Layer<AuthenticatedUser> {
	return Layer.succeed(AuthenticatedUser, (effect, { headers, rpc, payload }) =>
		sessionCommandChanges(effect, rpc, payload).pipe(
			(invocation) =>
				Effect.flatMap(Identity, ({ id }) => invocation.pipe(revalidateStream(policy, rpc, id, resolveSession(policy, headers, rpc._tag)))),
			withSessionUser(policy, headers, rpc._tag),
		),
	);
}

export interface ProviderAccountsSessionShape extends UserSessionShape {
	readonly user: SessionUserWithProviderAccountsValue;
}
export function authenticatedUserWithProviderAccountsLayer<TSession extends ProviderAccountsSessionShape>(
	policy: SessionPolicy<TSession>,
): Layer.Layer<AuthenticatedUserWithProviderAccounts> {
	return Layer.succeed(AuthenticatedUserWithProviderAccounts, (effect, { headers, rpc, payload }) =>
		Effect.gen(function* () {
			const session = yield* resolveSession(policy, headers, rpc._tag);
			if (Option.isNone(session)) {
				return yield* new Unauthorized({ message: "Authentication required" });
			}
			const { id, providerAccounts } = session.value.user;
			const accounts = yield* Effect.cachedWithTTL(
				Effect.map(providerAccounts, (values) => values.map(({ accountId, providerId }) => ({ accountId, providerId }))),
				(exit) => (Exit.isSuccess(exit) ? Duration.infinity : Duration.zero),
			);
			const user = sessionProfile(session.value.user);
			yield* identified(id);
			return yield* sessionCommandChanges(effect, rpc, payload).pipe(
				revalidateStream(policy, rpc, id, resolveSession(policy, headers, rpc._tag)),
				Effect.provideService(Identity, { id }),
				Effect.provideService(SessionUser, user),
				Effect.provideService(SessionUserWithProviderAccounts, { ...user, providerAccounts: accounts }),
				Effect.annotateLogs({ userId: id }),
			);
		}),
	);
}
