import { Effect } from "effect";
import { ORIGIN, type Provider } from "./harness.ts";

export function expireSession(provider: Provider, token: string) {
	return Effect.promise(async () => {
		const { rowCount } = await provider.database.query('UPDATE "session" SET "expiresAt" = $1 WHERE token = $2', [
			new Date(Date.UTC(2000, 0, 1)),
			token,
		]);
		if (rowCount !== 1) {
			throw new Error(`Cannot expire the session: expected one stored session, found ${rowCount}`);
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
		if (response.status !== 200) {
			throw new Error(`Cannot sign out: Better Auth returned HTTP ${response.status}`);
		}
	});
}
