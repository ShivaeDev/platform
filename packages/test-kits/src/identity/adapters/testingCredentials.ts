import { generateRandomString, makeSignature } from "better-auth/crypto";
import { Effect } from "effect";

export const testUserEmail = Effect.sync(() => `test-${generateRandomString(8)}@example.com`);

export const signedSessionToken = Effect.fnUntraced(function* (token: string, secret: string) {
	const signature = yield* Effect.promise(() => makeSignature(token, secret));
	return `${token}.${signature}`;
});
