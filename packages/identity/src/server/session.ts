import { Effect, Layer, Option, Schema } from "effect";
import type { Headers } from "effect/http";
import { authorizeReads } from "@shivaedev/contract/readPolicy.ts";
import { type AuthUnavailable, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import {
	Identity,
	OptionalIdentity,
	SessionUser,
	SessionUserSchema,
	type SessionUserValue,
	SessionUserWithProviderAccounts,
	type SessionUserWithProviderAccountsValue,
} from "#identity.ts";
import { Authenticated, AuthenticatedUser, AuthenticatedUserWithProviderAccounts, MaybeAuthenticated } from "#middleware.ts";
import { commandChanges } from "#server/commandChanges.ts";
import { providerAccountsUser } from "#server/providerAccountsUser.ts";
import { SessionPolicy } from "#server/SessionPolicy.ts";
import { lookupSession, sessionRequest } from "./lookupSession.ts";
import { recheckSession } from "./recheckSession.ts";
import { revalidateStream } from "./revalidateStream.ts";
export interface SessionShape {
	readonly user: {
		readonly id: string;
	};
}
export interface SessionProvider<TSession extends SessionShape> {
	readonly get: (headers: Headers.Headers) => Effect.Effect<Option.Option<TSession>, AuthUnavailable>;
}
export const resolveSession = Effect.fn("Identity.resolveSession")(function* (headers: Headers.Headers, rpc: string) {
	const request = yield* sessionRequest(headers, rpc);
	return yield* lookupSession(request.headers);
});
function identified(id: string) {
	return Effect.andThen(Effect.annotateCurrentSpan("user.id", id), Effect.succeed(id));
}
export function authenticatedLayer() {
	return Layer.effect(
		Authenticated,
		Effect.map(
			SessionPolicy,
			(policy) =>
				(effect, { headers, rpc, payload }) =>
					Effect.gen(function* () {
						const session = yield* resolveSession(headers, rpc._tag);
						if (Option.isNone(session)) {
							return yield* new Unauthorized({ message: "Authentication required" });
						}
						const id = yield* identified(session.value.user.id);
						return yield* authorizeReads(commandChanges(effect, rpc, payload), { payload, rpc }, Option.some({ id })).pipe(
							revalidateStream(rpc, id, recheckSession(headers, rpc._tag)),
							Effect.provideService(Identity, { id }),
							Effect.annotateLogs({ userId: id }),
						);
					}).pipe(Effect.provideService(SessionPolicy, policy)),
		),
	);
}
export function maybeAuthenticatedLayer() {
	return Layer.effect(
		MaybeAuthenticated,
		Effect.map(
			SessionPolicy,
			(policy) =>
				(effect, { headers, rpc, payload }) =>
					Effect.gen(function* () {
						const session = yield* resolveSession(headers, rpc._tag);
						if (Option.isNone(session)) {
							return yield* Effect.provideService(authorizeReads(effect, { payload, rpc }, Option.none()), OptionalIdentity, Option.none());
						}
						const id = yield* identified(session.value.user.id);
						return yield* authorizeReads(effect, { payload, rpc }, Option.some({ id })).pipe(
							revalidateStream(rpc, id, recheckSession(headers, rpc._tag)),
							Effect.provideService(OptionalIdentity, Option.some({ id })),
							Effect.annotateLogs({ userId: id }),
						);
					}).pipe(Effect.provideService(SessionPolicy, policy)),
		),
	);
}
export interface UserSessionShape extends SessionShape {
	readonly user: SessionUserValue;
}
export function withSessionUser(headers: Headers.Headers, operation: string) {
	return <A, E, R>(effect: Effect.Effect<A, E, R>) =>
		Effect.gen(function* () {
			const session = yield* resolveSession(headers, operation);
			if (Option.isNone(session)) {
				return yield* new Unauthorized({ message: "Authentication required" });
			}
			const user = Schema.decodeUnknownSync(SessionUserSchema)(session.value.user);
			const id = yield* identified(session.value.user.id);
			return yield* effect.pipe(
				Effect.provideService(Identity, { id }),
				Effect.provideService(SessionUser, user),
				Effect.annotateLogs({ userId: id }),
			);
		});
}
export function authenticatedUserLayer() {
	return Layer.effect(
		AuthenticatedUser,
		Effect.map(
			SessionPolicy,
			(policy) =>
				(effect, { headers, rpc, payload }) =>
					Effect.flatMap(Identity, (viewer) => authorizeReads(commandChanges(effect, rpc, payload), { payload, rpc }, Option.some(viewer))).pipe(
						(invocation) => Effect.flatMap(Identity, ({ id }) => invocation.pipe(revalidateStream(rpc, id, recheckSession(headers, rpc._tag)))),
						withSessionUser(headers, rpc._tag),
						Effect.provideService(SessionPolicy, policy),
					),
		),
	);
}

export interface ProviderAccountsSessionShape extends UserSessionShape {
	readonly user: SessionUserWithProviderAccountsValue;
}
export function authenticatedUserWithProviderAccountsLayer() {
	return Layer.effect(
		AuthenticatedUserWithProviderAccounts,
		Effect.map(
			SessionPolicy,
			(policy) =>
				(effect, { headers, rpc, payload }) =>
					Effect.gen(function* () {
						const session = yield* resolveSession(headers, rpc._tag);
						if (Option.isNone(session)) {
							return yield* new Unauthorized({ message: "Authentication required" });
						}
						const { providerAccounts, ...user } = yield* providerAccountsUser(session.value.user);
						const { id } = user;
						yield* identified(id);
						return yield* authorizeReads(commandChanges(effect, rpc, payload), { payload, rpc }, Option.some({ id })).pipe(
							revalidateStream(rpc, id, recheckSession(headers, rpc._tag)),
							Effect.provideService(Identity, { id }),
							Effect.provideService(SessionUser, user),
							Effect.provideService(SessionUserWithProviderAccounts, { ...user, providerAccounts }),
							Effect.annotateLogs({ userId: id }),
						);
					}).pipe(Effect.provideService(SessionPolicy, policy)),
		),
	);
}
