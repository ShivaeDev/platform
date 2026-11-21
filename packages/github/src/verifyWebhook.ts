import { Effect, Redacted, Result, Schema } from "effect";
import { Mac } from "effect/crypto";
import * as Hex from "effect/encoding/Hex";
import { GitHubWebhookSignatureError } from "#errors.ts";

const signedHeader = /^sha256=(?<tag>[0-9a-f]{64})$/u;

const verifySignature = Effect.fnUntraced(
	function* (body: Uint8Array, signature: string | undefined, secret: Redacted.Redacted<string>) {
		const hex = signature === undefined ? undefined : signedHeader.exec(signature)?.groups?.tag;
		const tag = hex === undefined ? undefined : Result.getOrUndefined(Hex.decode(hex));
		if (tag === undefined) {
			return yield* new GitHubWebhookSignatureError();
		}
		const mac = yield* Mac.Mac;
		const key = yield* Mac.key(Mac.hmacSha256, new TextEncoder().encode(Redacted.value(secret)));
		if (!(yield* mac.verify(key, tag, body))) {
			return yield* new GitHubWebhookSignatureError();
		}
	},
	Effect.catchTag("CryptoError", () => Effect.fail(new GitHubWebhookSignatureError())),
);

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
): Effect.Effect<void, GitHubWebhookSignatureError, Mac.Mac>;
export function verifyWebhook<TSchema extends Schema.Constraint>(
	body: Uint8Array,
	signature: string | undefined,
	secret: Redacted.Redacted<string>,
	schema: TSchema,
): Effect.Effect<TSchema["Type"], GitHubWebhookSignatureError | Schema.SchemaError, Mac.Mac | TSchema["DecodingServices"]>;
export function verifyWebhook<TSchema extends Schema.Constraint>(
	body: Uint8Array,
	signature: string | undefined,
	secret: Redacted.Redacted<string>,
	schema?: TSchema,
) {
	return verify(body, signature, secret, schema);
}
