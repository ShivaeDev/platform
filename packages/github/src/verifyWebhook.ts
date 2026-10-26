import { createHmac, timingSafeEqual } from "node:crypto";
import { Effect, Redacted, Schema } from "effect";
import { GitHubWebhookSignatureError } from "./errors.ts";

export const verifyWebhook = Effect.fnUntraced(function* <TSchema extends Schema.Constraint>(
	body: Uint8Array,
	signature: string | undefined,
	secret: Redacted.Redacted<string>,
	schema: TSchema,
) {
	if (signature === undefined || !/^sha256=[0-9a-f]{64}$/u.test(signature)) {
		return yield* new GitHubWebhookSignatureError();
	}
	const expected = createHmac("sha256", Redacted.value(secret)).update(body).digest();
	if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"))) {
		return yield* new GitHubWebhookSignatureError();
	}
	return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(new TextDecoder().decode(body));
});
