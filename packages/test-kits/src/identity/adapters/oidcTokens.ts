import { generateKeyPairSync, sign } from "node:crypto";
import type { OauthProfile } from "#identity/oauth.ts";

export function oidcTokens() {
	const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
	const key = { ...publicKey.export({ format: "jwk" }), alg: "RS256", kid: "story-key", use: "sig" };
	return {
		discovery: (issuer: string) => ({
			"authorization_endpoint": `${issuer}/login/oauth/authorize`,
			"code_challenge_methods_supported": ["S256"],
			"grant_types_supported": ["authorization_code"],
			"id_token_signing_alg_values_supported": ["RS256"],
			issuer,
			"jwks_uri": `${issuer}/jwks`,
			"response_types_supported": ["code"],
			"scopes_supported": ["openid", "profile", "email"],
			"subject_types_supported": ["public"],
			"token_endpoint": `${issuer}/login/oauth/access_token`,
			"token_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic"],
			"userinfo_endpoint": `${issuer}/userinfo`,
		}),
		jwks: { keys: [key] },
		sign: (profile: OauthProfile, issuer: string, audience: string, now: number, nonce: string | null) => {
			const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: key.kid, typ: "JWT" })).toString("base64url");
			const payload = Buffer.from(
				JSON.stringify({
					aud: audience,
					email: profile.email,
					"email_verified": profile.emailVerified ?? true,
					exp: Math.floor(now / 1000) + 3600,
					iat: Math.floor(now / 1000),
					iss: issuer,
					name: profile.name,
					...(nonce === null ? {} : { nonce }),
					sub: profile.sub,
				}),
			).toString("base64url");
			const body = `${header}.${payload}`;
			return `${body}.${sign("RSA-SHA256", Buffer.from(body), privateKey).toString("base64url")}`;
		},
	};
}
