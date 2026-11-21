import type { BetterAuthOptions } from "better-auth";
import { Clock, Effect, Schema } from "effect";
import { providerFailure } from "#server/providerFailure.ts";

const SessionReferences = Schema.fromJsonString(Schema.Array(Schema.Struct({ token: Schema.String })));
const ADDRESS_CODES = ["email-verification", "sign-in", "forget-password"];

// Better Auth 1.7 keeps these keys in secondary storage and revokes a user's sessions with the same writes in deleteCachedUserSessions:
// a revoked-before time its session lookup checks, and the tokens listed as the user's active sessions. Its other codes are keyed by
// a token or a new address that only the email holds, so only the exact address codes can be found here.
export const evictCachedAccount = Effect.fn("Identity.evictCachedAccount")(function* (
	options: Omit<BetterAuthOptions, "database">,
	user: { readonly email: string; readonly id: string },
) {
	const storage = options.secondaryStorage;
	if (storage === undefined) {
		return;
	}
	function call<A>(run: () => A | Promise<A>) {
		return Effect.tryPromise(async () => await run()).pipe(Effect.catch(providerFailure));
	}
	const revokedKey = `revoked-sessions-before-${user.id}`;
	const activeKey = `active-sessions-${user.id}`;
	const lifetime = Math.max(options.session?.expiresIn || 604_800, 86_400);
	const now = yield* Clock.currentTimeMillis;
	const previous = Number(yield* call(() => storage.get(revokedKey))) || 0;
	yield* call(() => storage.set(revokedKey, String(Math.max(now, previous)), lifetime));
	const listed = yield* call(() => storage.get(activeKey));
	const references =
		typeof listed === "string" ? yield* Schema.decodeUnknownEffect(SessionReferences)(listed).pipe(Effect.orElseSucceed(() => [])) : [];
	for (const { token } of references) {
		yield* call(() => storage.delete(token));
	}
	yield* call(() => storage.delete(activeKey));
	if (options.verification?.storeInDatabase !== true) {
		for (const type of ADDRESS_CODES) {
			yield* call(() => storage.delete(`verification:${type}-otp-${user.email}`));
		}
	}
});
