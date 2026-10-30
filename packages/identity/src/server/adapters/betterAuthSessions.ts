import { Effect, Option, Predicate } from "effect";
import type { Headers } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { type AuthUnavailable, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import type { ProviderAccountValue } from "#identity.ts";
import { providerFailure } from "#server/providerFailure.ts";
import type { SessionProvider, SessionShape } from "#server/session.ts";
export type GetSession<TSession extends SessionShape> = (headers: globalThis.Headers) => Promise<TSession | null>;
export type GetProviderAccounts = (headers: globalThis.Headers) => Promise<readonly ProviderAccountValue[]>;
export type SessionWithProviderAccounts<TSession extends SessionShape> = TSession & {
	readonly user: TSession["user"] & { readonly providerAccounts: Effect.Effect<readonly ProviderAccountValue[], AuthUnavailable | Unauthorized> };
};
export function betterAuthSessions<TSession extends SessionShape>(getSession: GetSession<TSession>): SessionProvider<TSession>;
export function betterAuthSessions<TSession extends SessionShape>(
	getSession: GetSession<TSession>,
	getProviderAccounts: GetProviderAccounts,
): SessionProvider<SessionWithProviderAccounts<TSession>>;
export function betterAuthSessions<TSession extends SessionShape>(getSession: GetSession<TSession>, getProviderAccounts?: GetProviderAccounts) {
	const betterAuthSession = Effect.fn("PlatformRpc.betterAuthSession")(function* (headers: Headers.Headers) {
		const transport = new globalThis.Headers(headers);
		const session = yield* Effect.tryPromise(() => getSession(transport)).pipe(Effect.catch((error) => providerFailure(error.cause)));
		if (session === null || getProviderAccounts === undefined) {
			return Option.fromNullishOr(session);
		}
		const providerAccounts = Effect.tryPromise({
			catch: (cause) => cause,
			try: () => getProviderAccounts(transport),
		}).pipe(
			Effect.catch(
				(cause): Effect.Effect<never, AuthUnavailable | Unauthorized> =>
					Predicate.hasProperty(cause, "statusCode") && cause.statusCode === HttpStatus.fromLiteral("Unauthorized")
						? Effect.fail(new Unauthorized({ message: "Authentication required" }))
						: providerFailure(cause),
			),
		);
		return Option.some({ ...session, user: { ...session.user, providerAccounts } });
	});
	return { get: betterAuthSession };
}
