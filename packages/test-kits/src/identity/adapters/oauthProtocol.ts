import { createHash, randomUUID } from "node:crypto";
import { Clock, Effect } from "effect";
import type { FakeHttpReply, FakeHttpRequest, FakeHttpRoute } from "@shivaedev/test-story/server/fakeHttpService.ts";
import type { OauthProfile } from "#identity/oauth.ts";
import { type OauthProtocolOptions, oauthAuthorization } from "./oauthAuthorization.ts";
import { oidcTokens } from "./oidcTokens.ts";

function validVerifier(query: URLSearchParams, form: URLSearchParams) {
	return (
		query.get("code_challenge_method") === "S256"
		&& createHash("sha256")
			.update(form.get("code_verifier") ?? "")
			.digest("base64url") === query.get("code_challenge")
	);
}

function clientCredentials(authorization: string | undefined, form: URLSearchParams) {
	if (authorization?.startsWith("Basic ")) {
		const [clientId, clientSecret] = Buffer.from(authorization.slice(6), "base64").toString().split(":");
		return { clientId, clientSecret };
	}
	return { clientId: form.get("client_id"), clientSecret: form.get("client_secret") };
}

export const oauthProtocol = Effect.fnUntraced(function* (options: Omit<OauthProtocolOptions, "now">) {
	const clock = yield* Clock.Clock;
	const authorization = oauthAuthorization({ ...options, now: () => clock.currentTimeMillisUnsafe() });
	const { codes } = authorization;
	const tokens = new Map<string, { readonly profile: OauthProfile; readonly expires: number }>();
	const signing = oidcTokens();
	let issuer = "";
	function refused(error: string, status = 400): FakeHttpReply {
		return { body: { error }, status };
	}
	function profileOf({ headers }: FakeHttpRequest) {
		const token = tokens.get(headers.authorization?.replace(/^Bearer /iu, "") ?? "");
		return token !== undefined && token.expires > clock.currentTimeMillisUnsafe() ? token.profile : undefined;
	}
	function exchange({ body, headers }: FakeHttpRequest): FakeHttpReply {
		const form = new URLSearchParams(body.toString());
		const credentials = clientCredentials(headers.authorization, form);
		if (credentials.clientId !== options.clientId || credentials.clientSecret !== options.clientSecret) {
			return refused("invalid_client", 401);
		}
		if (form.get("grant_type") !== "authorization_code") {
			return refused("unsupported_grant_type");
		}
		const value = form.get("code") ?? "";
		const code = codes.get(value);
		if (code === undefined || code.expires <= clock.currentTimeMillisUnsafe() || code.query.get("redirect_uri") !== form.get("redirect_uri")) {
			return refused("invalid_grant");
		}
		const challenge = code.query.get("code_challenge");
		if (challenge !== null && !validVerifier(code.query, form)) {
			return refused("invalid_grant");
		}
		codes.delete(value);
		const accessToken = randomUUID();
		tokens.set(accessToken, { expires: clock.currentTimeMillisUnsafe() + 3_600_000, profile: code.profile });
		return {
			body: {
				"access_token": accessToken,
				"expires_in": 3600,
				"id_token": signing.sign(code.profile, issuer, options.clientId, clock.currentTimeMillisUnsafe(), code.query.get("nonce")),
				"refresh_token": randomUUID(),
				scope: code.query.get("scope") ?? "",
				"token_type": "Bearer",
			},
		};
	}
	const routes: Record<string, FakeHttpRoute> = {
		authorize: { path: "/login/oauth/authorize", reply: authorization.authorize },
		discovery: { path: "/.well-known/openid-configuration", reply: () => ({ body: signing.discovery(issuer) }) },
		emails: {
			path: "/user/emails",
			reply: (request) => {
				const profile = profileOf(request);
				return profile === undefined
					? refused("invalid_token", 401)
					: { body: [{ email: profile.email, primary: true, verified: profile.emailVerified ?? true }] };
			},
		},
		jwks: { path: "/jwks", reply: () => ({ body: signing.jwks }) },
		token: { method: "POST", path: "/login/oauth/access_token", reply: exchange },
		user: {
			path: "/user",
			reply: (request) => {
				const profile = profileOf(request);
				return profile === undefined
					? refused("invalid_token", 401)
					: { body: { "avatar_url": null, email: profile.email, id: profile.sub, login: profile.name, name: profile.name } };
			},
		},
		userinfo: {
			path: "/userinfo",
			reply: (request) => {
				const profile = profileOf(request);
				return profile === undefined
					? refused("invalid_token", 401)
					: { body: { email: profile.email, "email_verified": profile.emailVerified ?? true, name: profile.name, sub: profile.sub } };
			},
		},
	};
	return {
		consent: authorization.consent,
		issuer: (url: string) => {
			issuer = url;
		},
		routes,
	};
});
