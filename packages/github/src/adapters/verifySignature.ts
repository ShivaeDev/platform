import { createHmac, timingSafeEqual } from "node:crypto";
import { Effect, Redacted } from "effect";
import { GitHubWebhookSignatureError } from "#errors.ts";

export const verifySignature = Effect.fnUntraced(function* (body: Uint8Array, signature: string | undefined, secret: Redacted.Redacted<string>) {
	if (signature === undefined || !/^sha256=[0-9a-f]{64}$/u.test(signature)) {
		return yield* new GitHubWebhookSignatureError();
	}
	const expected = createHmac("sha256", Redacted.value(secret)).update(body).digest();
	if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"))) {
		return yield* new GitHubWebhookSignatureError();
	}
});
