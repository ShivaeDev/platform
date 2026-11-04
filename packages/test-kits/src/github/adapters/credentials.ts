import { createHmac, generateKeyPairSync, type KeyObject, verify } from "node:crypto";
import { Option, Schema } from "effect";

export function githubAppCredentials() {
	const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
	const appId = "123456";
	const webhookSecret = "webhook-secret";
	return {
		appId,
		appJwtOf: (authorization: string | undefined, nowMillis: number) => appJwtOf(keys.publicKey, authorization, nowMillis),
		privateKey: keys.privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
		signedByApp: (jwt: AppJwt | undefined) => signedByApp(appId, jwt),
		tokenPrefix: "installation-token-secret",
		webhookSecret,
		webhookSignature: (body: Uint8Array) => `sha256=${createHmac("sha256", webhookSecret).update(body).digest("hex")}`,
	};
}

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

export function appJwtOf(publicKey: KeyObject, authorization: string | undefined, nowMillis: number): AppJwt | undefined {
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
		signedBy: verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, "base64url"))
			? "the App's key"
			: "another key",
		type: fields.value.typ,
	};
}

export function signedByApp(appId: string, jwt: AppJwt | undefined) {
	return (
		jwt !== undefined
		&& jwt.signedBy === "the App's key"
		&& jwt.algorithm === "RS256"
		&& jwt.issuer === appId
		&& jwt.issuedAgo >= 0
		&& jwt.issuedAgo <= 600
		&& jwt.expiresIn > 0
		&& jwt.expiresIn <= 600
	);
}
