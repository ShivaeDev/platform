import * as PgTypes from "@effect/sql-pg/PgTypes";
import { Effect, Schema, SchemaGetter, SchemaIssue } from "effect";
import { Aead, SecureRandom } from "effect/crypto";
import { Model } from "effect/schema";
import { ColumnKey } from "#ColumnKey.ts";
import { ENCRYPTED } from "#encryptedKeys.ts";

// The version byte comes first and is authenticated with the sealed bytes, so a later format or key can be told apart from this one.
const VERSION = 1;
const header = Uint8Array.of(VERSION);
const nonceLength = Aead.xchacha20Poly1305.nonceLength;
const TAG_LENGTH = 16;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function refused(message: string) {
	return new SchemaIssue.InvalidValue({ message });
}

const columnKey = Effect.gen(function* () {
	const load = yield* ColumnKey;
	return yield* Effect.mapError(load, (error) => refused(error.message));
});

const seal = Effect.fnUntraced(function* (text: string) {
	const key = yield* columnKey;
	const nonce = yield* (yield* SecureRandom.SecureRandom).randomBytes(nonceLength);
	const sealed = yield* Effect.mapError((yield* Aead.Aead).encrypt(key, encoder.encode(text), { aad: header, nonce }), () =>
		refused("the value could not be sealed with the column key"),
	);
	const stored = new Uint8Array(header.length + nonceLength + sealed.length);
	stored.set(header);
	stored.set(nonce, header.length);
	stored.set(sealed, header.length + nonceLength);
	return PgTypes.bytea(stored);
});

const open = Effect.fnUntraced(function* (stored: unknown) {
	if (!(stored instanceof Uint8Array) || stored.length < header.length + nonceLength + TAG_LENGTH) {
		return yield* Effect.fail(refused("the column does not hold a sealed value"));
	}
	if (stored[0] !== VERSION) {
		return yield* Effect.fail(refused(`the sealed value has format version ${stored[0]}, which this version of @shivaedev/sql cannot open`));
	}
	const key = yield* columnKey;
	const opened = yield* Effect.mapError(
		(yield* Aead.Aead).decrypt(key, stored.subarray(header.length + nonceLength), {
			aad: stored.subarray(0, header.length),
			nonce: stored.subarray(header.length, header.length + nonceLength),
		}),
		() => refused("the sealed value does not open with the column key: it was sealed with another key or its bytes were changed"),
	);
	return decoder.decode(opened);
});

// The value travels as the JSON text of its encoded form, so any schema serverOnly takes can be sealed, null included.
export function encrypted<TValue extends Schema.Top>(value: TValue) {
	const Text = Schema.fromJsonString(Schema.toCodecJson(value));
	const Stored = Schema.Unknown.pipe(
		Schema.decodeTo(Schema.String, { decode: SchemaGetter.transformEffect(open), encode: SchemaGetter.transformEffect(seal) }),
		Schema.decodeTo(Schema.RedactedFromValue(Text)),
	);
	const Read = Schema.Unknown.pipe(
		Schema.decodeTo(Schema.String, {
			decode: SchemaGetter.transformEffect(open),
			encode: SchemaGetter.forbidden(() => "Cannot encode an encrypted field: its value never leaves the server"),
		}),
		Schema.decodeTo(Schema.RedactedFromValue(Text, { disallowEncode: true })),
	);
	return Model.Field({ insert: Stored, select: Read.annotate({ [ENCRYPTED]: true }), update: Stored });
}
