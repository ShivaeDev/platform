import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { ORIGIN, type Provider } from "./harness.ts";

export function expireSession(provider: Provider, token: string) {
	return Effect.promise(async () => {
		const { internalAdapter } = await provider.auth.$context;
		const session = await internalAdapter.updateSession(token, { expiresAt: new Date(Date.UTC(2000, 0, 1)) });
		if (session === null) {
			throw new Error("Cannot expire the session: no stored session matches the token");
		}
	});
}

export function signOut(provider: Provider, headers: Record<string, string>) {
	return Effect.promise(async () => {
		const response = await provider.auth.handler(
			new Request(`${ORIGIN}/api/auth/sign-out`, {
				body: "{}",
				headers: { ...headers, "content-type": "application/json" },
				method: "POST",
			}),
		);
		if (response.status !== HttpStatus.fromLiteral("OK")) {
			throw new Error(`Cannot sign out: Better Auth returned HTTP ${response.status}`);
		}
	});
}
