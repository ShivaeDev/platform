import type { Effect } from "effect";
import { expectTypeOf } from "vitest";
import type { SessionUserValue } from "#identity.ts";
import type { GetSession, SessionWithProviderAccounts } from "#server/adapters/betterAuthSessions.ts";
import type { SessionProvider } from "#server/session.ts";
import type { betterAuthMount } from "./mount.ts";

interface ApplicationSession {
	readonly session: { readonly expiresAt: Date };
	readonly user: { readonly email: string; readonly id: string; readonly name: string; readonly tenant: string };
}

export function admittedSessionTypes(mounted: Effect.Success<ReturnType<typeof betterAuthMount>>, getSession: GetSession<ApplicationSession>) {
	const plain = mounted.admittedSessions(getSession);
	const accounts = mounted.admittedSessions(getSession, (headers) => mounted.auth.api.listUserAccounts({ headers }));
	expectTypeOf(plain).toEqualTypeOf<SessionProvider<ApplicationSession>>();
	expectTypeOf(accounts).toEqualTypeOf<SessionProvider<SessionWithProviderAccounts<ApplicationSession>>>();
	expectTypeOf(mounted.sessions.provider).toEqualTypeOf<SessionProvider<{ readonly user: SessionUserValue }>>();
}
