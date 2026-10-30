import { createHmac, generateKeyPairSync, verify } from "node:crypto";
import { Option, Schema } from "effect";

const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
export const PRIVATE_KEY = keys.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
export const INVALID_PRIVATE_KEY = "invalid-private-key-secret";
export const APP_ID = "123456";
export const APP_TOKEN = "installation-token-secret";
export const WEBHOOK_SECRET = "webhook-secret";
export const WRONG_SECRET = "wrong-webhook-secret";
export const WORKFLOW_BODY = Buffer.from('{"action":"completed","workflow_run":{"id":42,"conclusion":"success"}}');

const Claims = Schema.fromJsonString(Schema.Struct({ exp: Schema.Number, iat: Schema.Number, iss: Schema.String }));
const Header = Schema.fromJsonString(Schema.Struct({ alg: Schema.String, typ: Schema.String }));

export interface AppJwt {
	readonly algorithm: string;
	readonly expiresIn: number;
	readonly issuedAgo: number;
	readonly issuer: string;
	readonly signedBy: "the App's key" | "another key";
	readonly type: string;
}

export function appJwtOf(authorization: string | undefined, nowMillis: number): AppJwt | undefined {
	const [header = "", payload = "", signature = ""] = (authorization?.replace(/^Bearer /u, "") ?? "").split(".");
	const claims = Schema.decodeUnknownOption(Claims)(Buffer.from(payload, "base64url").toString());
	const fields = Schema.decodeUnknownOption(Header)(Buffer.from(header, "base64url").toString());
	if (Option.isNone(claims) || Option.isNone(fields)) {
		return undefined;
	}
	const now = nowMillis / 1000;
	return {
		algorithm: fields.value.alg,
		expiresIn: claims.value.exp - now,
		issuedAgo: now - claims.value.iat,
		issuer: claims.value.iss,
		signedBy: verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), keys.publicKey, Buffer.from(signature, "base64url"))
			? "the App's key"
			: "another key",
		type: fields.value.typ,
	};
}

export function signedByApp(jwt: AppJwt | undefined) {
	return (
		jwt !== undefined
		&& jwt.signedBy === "the App's key"
		&& jwt.algorithm === "RS256"
		&& jwt.issuer === APP_ID
		&& jwt.issuedAgo === 60
		&& jwt.expiresIn > 0
		&& jwt.expiresIn <= 600
	);
}

export function webhookSignature(body: Uint8Array = WORKFLOW_BODY) {
	return `sha256=${createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex")}`;
}
