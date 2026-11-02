import { generateKeyPairSync, sign } from "node:crypto";

export function tokenSigner() {
	const keys = generateKeyPairSync("ed25519");
	const jwk = { ...keys.publicKey.export({ format: "jwk" }), alg: "EdDSA", kid: "claim-stories" };
	return {
		jwk,
		sign: (claims: Record<string, unknown>) => {
			const header = Buffer.from(JSON.stringify({ alg: jwk.alg, kid: jwk.kid, typ: "JWT" })).toString("base64url");
			const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
			const input = `${header}.${payload}`;
			return `${input}.${sign(null, Buffer.from(input), keys.privateKey).toString("base64url")}`;
		},
	};
}
