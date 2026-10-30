import { Effect, Option } from "effect";
import { Headers as HttpHeaders } from "effect/http";
import {
	betterAuthSessions,
	type GetProviderAccounts,
	type GetSession,
	type SessionWithProviderAccounts,
} from "#server/adapters/betterAuthSessions.ts";
import { providerFailure } from "#server/providerFailure.ts";
import type { SessionProvider, SessionShape } from "#server/session.ts";
import { type BearerSessionsOptions, sessionHeaders } from "./bearerSessions.ts";
import { fromStorage, type PolicyStorage, type SignInGate } from "./signInGate.ts";

interface SessionStorage extends PolicyStorage {
	readonly authCookies: { readonly sessionToken: { readonly name: string } };
}

export function admittedSessions<E>(gate: SignInGate<E>, storage: () => Promise<SessionStorage>, bearerSessions?: BearerSessionsOptions) {
	function admit<TSession extends SessionShape>(getSession: GetSession<TSession>): SessionProvider<TSession>;
	function admit<TSession extends SessionShape>(
		getSession: GetSession<TSession>,
		getProviderAccounts: GetProviderAccounts,
	): SessionProvider<SessionWithProviderAccounts<TSession>>;
	function admit<TSession extends SessionShape>(getSession: GetSession<TSession>, getProviderAccounts?: GetProviderAccounts) {
		const provider = getProviderAccounts === undefined ? betterAuthSessions(getSession) : betterAuthSessions(getSession, getProviderAccounts);
		return {
			get: Effect.fnUntraced(function* (headers) {
				const auth = gate.active || bearerSessions !== undefined ? yield* fromStorage(storage) : undefined;
				const selected =
					bearerSessions === undefined || auth === undefined
						? headers
						: HttpHeaders.fromInput(sessionHeaders(new Headers(headers), auth.authCookies.sessionToken.name));
				const session = yield* provider.get(selected);
				if (!gate.active || Option.isNone(session) || auth === undefined) {
					return session;
				}
				const userId = session.value.user.id;
				const admitted = yield* gate.admitsUser(auth, userId).pipe(Effect.catch(providerFailure));
				if (admitted) {
					return session;
				}
				yield* fromStorage(() => auth.internalAdapter.deleteUserSessions(userId));
				yield* Effect.logInfo("The sign-in policy revoked a user's sessions").pipe(Effect.annotateLogs({ userId }));
				return Option.none();
			}),
		};
	}
	return admit;
}
