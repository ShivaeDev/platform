import { Effect, Option, Predicate } from "effect";
import type { Headers } from "effect/http";
import { AuthUnavailable } from "#errors/taxonomy.ts";
import type { ProviderAccountValue } from "#rpc/identity.ts";
import { redact } from "#server/rpc-server/redact.ts";
import type { SessionProvider, SessionShape } from "#server/rpc-server/session.ts";
export type GetSession<TSession extends SessionShape> = (headers: globalThis.Headers) => Promise<TSession | null>;
export type GetProviderAccounts = (headers: globalThis.Headers) => Promise<readonly ProviderAccountValue[]>;
export type SessionWithProviderAccounts<TSession extends SessionShape> = TSession & {
	readonly user: TSession["user"] & { readonly providerAccounts: readonly ProviderAccountValue[] };
};
function unavailable(cause: unknown) {
	return Effect.andThen(
		Effect.logError("Authentication provider failed", redact(cause)),
		Effect.fail(new AuthUnavailable({ message: "Authentication is temporarily unavailable" })),
	);
}
export function betterAuthSessions<TSession extends SessionShape>(getSession: GetSession<TSession>): SessionProvider<TSession>;
export function betterAuthSessions<TSession extends SessionShape>(
	getSession: GetSession<TSession>,
	getProviderAccounts: GetProviderAccounts,
): SessionProvider<SessionWithProviderAccounts<TSession>>;
export function betterAuthSessions<TSession extends SessionShape>(getSession: GetSession<TSession>, getProviderAccounts?: GetProviderAccounts) {
	const betterAuthSession = Effect.fn("PlatformRpc.betterAuthSession")(function* (headers: Headers.Headers) {
		const session = yield* Effect.tryPromise(async () => {
			const transport = new globalThis.Headers(headers);
			const resolved = await getSession(transport);
			if (resolved === null || getProviderAccounts === undefined) {
				return resolved;
			}
			const accounts = await getProviderAccounts(transport).catch((cause: unknown) => {
				if (Predicate.hasProperty(cause, "statusCode") && cause.statusCode === 401) {
					return null;
				}
				throw cause;
			});
			if (accounts === null) {
				return null;
			}
			return {
				...resolved,
				user: { ...resolved.user, providerAccounts: accounts },
			};
		}).pipe(Effect.catch((error) => unavailable(error.cause)));
		return Option.fromNullishOr(session);
	});
	return { get: betterAuthSession };
}
