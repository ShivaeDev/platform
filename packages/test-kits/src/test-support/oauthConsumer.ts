import { createHash } from "node:crypto";
import { Effect, Schema } from "effect";
import { TestClock } from "effect/testing";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { fakeOauthProvider } from "#identity/oauth.ts";

const TokenReply = Schema.Struct({
	accessToken: Schema.optional(Schema.String),
	error: Schema.optional(Schema.String),
}).pipe(Schema.encodeKeys({ accessToken: "access_token" }));
const VERIFIER = "story-verifier-for-pkce-with-at-least-43-characters";

export const oauthConsumer = storyKit({
	clock: "test",
	*create() {
		return {
			accessToken: "",
			code: "",
			provider: yield* fakeOauthProvider({
				codeLifetime: "30 seconds",
				profile: { email: "carol@example.test", emailVerified: false, name: "Carol", sub: "carol-id" },
			}),
		};
	},
	name: "OAuth provider",
	stages: ["provider"],
	verbs: (engine, story) => {
		const { provider } = engine;
		provider.server.narrate(story.tell);
		return {
			authorize: () =>
				Effect.promise(async () => {
					story.tell("Carol consents to the client's authorization request");
					const query = new URLSearchParams({
						"client_id": provider.credentials.clientId,
						"code_challenge": createHash("sha256").update(VERIFIER).digest("base64url"),
						"code_challenge_method": "S256",
						"redirect_uri": "http://app.test/callback",
						"response_type": "code",
						scope: "openid profile email",
						state: "client-state",
					});
					const response = await fetch(`${provider.server.url}/login/oauth/authorize?${query}`, { redirect: "manual" });
					const callback = new URL(response.headers.get("location") ?? "");
					engine.code = callback.searchParams.get("code") ?? "";
					return { error: callback.searchParams.get("error"), state: callback.searchParams.get("state"), status: response.status };
				}),
			codeLifetimePasses: () => TestClock.adjust("30 seconds"),
			exchange: (fields: Record<string, string> = {}, basic = false) =>
				Effect.promise(async () => {
					story.tell("the client exchanges the authorization code over HTTP");
					const body = new URLSearchParams({
						"client_id": provider.credentials.clientId,
						"client_secret": provider.credentials.clientSecret,
						code: engine.code,
						"code_verifier": VERIFIER,
						"grant_type": "authorization_code",
						"redirect_uri": "http://app.test/callback",
						...fields,
					});
					const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
					if (basic) {
						headers.authorization = `Basic ${Buffer.from(`${provider.credentials.clientId}:${provider.credentials.clientSecret}`).toString("base64")}`;
						body.delete("client_id");
						body.delete("client_secret");
					}
					const response = await fetch(`${provider.server.url}/login/oauth/access_token`, { body, headers, method: "POST" });
					const reply = Schema.decodeUnknownSync(TokenReply)(await response.json());
					engine.accessToken = reply.accessToken ?? "";
					return { error: reply.error ?? null, status: response.status };
				}),
			profile: () =>
				Effect.promise(async () => {
					story.tell("the client reads Carol's profile using the issued access token");
					const response = await fetch(`${provider.server.url}/userinfo`, { headers: { authorization: `Bearer ${engine.accessToken}` } });
					return { body: await response.json(), status: response.status };
				}),
			tokenLifetimePasses: () => TestClock.adjust("1 hour"),
		};
	},
});
