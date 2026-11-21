import { Clock, Effect, Redacted } from "effect";
import { KeyFormat, Signature } from "effect/crypto";
import * as Base64Url from "effect/encoding/Base64Url";
import { GitHubAppError } from "#errors.ts";

export interface AppCredentials {
	readonly appId: string;
	readonly privateKey: Redacted.Redacted<string>;
}

const header = Base64Url.encode(JSON.stringify({ alg: "RS256", typ: "JWT" }));

// GitHub issues App keys as PKCS#1 PEM; a key converted to PKCS#8 signs the same way.
function decodePrivateKey(privateKey: Redacted.Redacted<string>) {
	const pem = Redacted.value(privateKey);
	return KeyFormat.decodePrivate(KeyFormat.pem(KeyFormat.pkcs1), Signature.rsaPkcs1v15Sha256, pem).pipe(
		Effect.catch(() => KeyFormat.decodePrivate(KeyFormat.pem(KeyFormat.pkcs8), Signature.rsaPkcs1v15Sha256, pem)),
	);
}

export const appJwt = Effect.fnUntraced(
	function* (options: AppCredentials) {
		const signature = yield* Signature.Signature;
		const now = Math.floor((yield* Clock.currentTimeMillis) / 1000);
		// GitHub documents an `exp` at most ten minutes ahead of its clock and an `iat` in the past; a minute of margin on each side absorbs clock drift.
		const input = `${header}.${Base64Url.encode(JSON.stringify({ exp: now + 540, iat: now - 60, iss: options.appId }))}`;
		const signed = yield* signature.sign(yield* decodePrivateKey(options.privateKey), new TextEncoder().encode(input));
		return Redacted.make(`${input}.${Base64Url.encode(signed)}`);
	},
	Effect.mapError((cause) => new GitHubAppError({ reason: "sign" }, { cause })),
);
