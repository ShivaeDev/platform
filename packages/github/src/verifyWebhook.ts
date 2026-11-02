import { Effect, type Redacted, Schema } from "effect";
import { verifySignature } from "#adapters/verifySignature.ts";
import type { GitHubWebhookSignatureError } from "#errors.ts";

const verify = Effect.fnUntraced(function* <TSchema extends Schema.Constraint>(
	body: Uint8Array,
	signature: string | undefined,
	secret: Redacted.Redacted<string>,
	schema?: TSchema,
) {
	yield* verifySignature(body, signature, secret);
	if (schema === undefined) {
		return;
	}
	return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(new TextDecoder().decode(body));
});

export function verifyWebhook(
	body: Uint8Array,
	signature: string | undefined,
	secret: Redacted.Redacted<string>,
): Effect.Effect<void, GitHubWebhookSignatureError>;
export function verifyWebhook<TSchema extends Schema.Constraint>(
	body: Uint8Array,
	signature: string | undefined,
	secret: Redacted.Redacted<string>,
	schema: TSchema,
): Effect.Effect<TSchema["Type"], GitHubWebhookSignatureError | Schema.SchemaError, TSchema["DecodingServices"]>;
export function verifyWebhook<TSchema extends Schema.Constraint>(
	body: Uint8Array,
	signature: string | undefined,
	secret: Redacted.Redacted<string>,
	schema?: TSchema,
) {
	return verify(body, signature, secret, schema);
}
