import { createHash } from "node:crypto";
import { Effect } from "effect";
import { signedInUser } from "@shivaedev/identity/server/better-auth/testing.ts";
import type { Host } from "./host.ts";

const VERIFIER = "mcp-story-pkce-verifier-long-enough-for-sha256";
const CALLBACK = "http://localhost:8123/callback";
export function oauthVerbs(host: Host, tell: (line: string) => void) {
	return {
		authorize: (clientId: string, cookie: string) =>
			Effect.promise(async () => {
				tell("the signed-in user authorizes the client");
				const query = new URLSearchParams({
					"client_id": clientId,
					"code_challenge": createHash("sha256").update(VERIFIER).digest("base64url"),
					"code_challenge_method": "S256",
					"redirect_uri": CALLBACK,
					resource: host.resource,
					"response_type": "code",
					scope: "mcp",
					state: "client-state",
				});
				const response = await fetch(`${host.baseUrl}/api/auth/oauth2/authorize?${query}`, {
					headers: { accept: "application/json", cookie },
					redirect: "manual",
				});
				return { body: await response.text(), location: response.headers.get("location"), status: response.status };
			}),
		changeRole: (id: string, role: "admin" | "user", cookie: string) =>
			Effect.promise(async () => {
				tell("the administrator changes the stored role");
				const response = await fetch(`${host.baseUrl}/api/auth/admin/set-role`, {
					body: JSON.stringify({ role, userId: id }),
					headers: { "content-type": "application/json", cookie, origin: host.baseUrl },
					method: "POST",
				});
				await response.text();
				return response.status;
			}),
		consent: (query: string, cookie: string) =>
			Effect.promise(async () => {
				tell("the user grants consent");
				const response = await fetch(`${host.baseUrl}/api/auth/oauth2/consent`, {
					body: JSON.stringify({ accept: true, "oauth_query": query }),
					headers: { "content-type": "application/json", cookie, origin: host.baseUrl },
					method: "POST",
					redirect: "manual",
				});
				return { body: await response.json(), location: response.headers.get("location"), status: response.status };
			}),
		exchange: (clientId: string, code: string) =>
			Effect.promise(async () => {
				tell("the client exchanges the code and PKCE VERIFIER");
				const response = await fetch(`${host.baseUrl}/api/auth/oauth2/token`, {
					body: new URLSearchParams({
						"client_id": clientId,
						code,
						"code_verifier": VERIFIER,
						"grant_type": "authorization_code",
						"redirect_uri": CALLBACK,
						resource: host.resource,
					}),
					headers: { "content-type": "application/x-www-form-urlencoded" },
					method: "POST",
				});
				return { body: await response.json(), status: response.status };
			}),
		mintSession: (role: "user" | "admin") =>
			Effect.promise(async () => {
				tell(`a ${role} is already signed in`);
				const session = await signedInUser(host.auth, { email: `${role}@mcp.test`, name: role, role });
				return { cookie: session.headers.get("cookie") ?? "", id: session.user.id };
			}),
		mintToken: (id: string, audience = host.resource, scope = "mcp") =>
			Effect.promise(async () => {
				tell("the client starts with a signed access token");
				return (await host.auth.api.signJWT({ body: { payload: { aud: audience, iss: `${host.baseUrl}/api/auth`, scope, sub: id } } })).token;
			}),
		register: () =>
			Effect.promise(async () => {
				tell("the client registers its callback");
				const response = await fetch(`${host.baseUrl}/api/auth/oauth2/register`, {
					body: JSON.stringify({
						"application_type": "native",
						"client_name": "Story client",
						"grant_types": ["authorization_code"],
						"redirect_uris": [CALLBACK],
						"response_types": ["code"],
						scope: "mcp",
						"token_endpoint_auth_method": "none",
					}),
					headers: { "content-type": "application/json" },
					method: "POST",
				});
				return { body: await response.json(), status: response.status };
			}),
	};
}
