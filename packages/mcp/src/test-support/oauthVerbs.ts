import { createHash } from "node:crypto";
import { Effect } from "effect";
import { type Engine, person } from "./host.ts";

function verifier(client: string) {
	return `mcp-story-pkce-verifier-long-enough-for-sha256-${client}`;
}
const CALLBACK = "http://localhost:8123/callback";

function flow(engine: Engine, client: string) {
	const registered = engine.flows.get(client);
	if (registered === undefined) {
		throw new Error(`${client} has not registered`);
	}
	return registered;
}

function step<A>(line: string, tell: (line: string) => void, run: () => Promise<A>) {
	return Effect.suspend(() => {
		tell(line);
		return Effect.promise(run);
	});
}

export function oauthVerbs(engine: Engine, tell: (line: string) => void) {
	const auth = `${engine.baseUrl}/api/auth`;
	return {
		authorizes: (name: string, client = name) =>
			step(`${name} authorizes ${client} in the browser`, tell, async () => {
				const query = new URLSearchParams({
					"client_id": flow(engine, client).clientId,
					"code_challenge": createHash("sha256").update(verifier(client)).digest("base64url"),
					"code_challenge_method": "S256",
					"redirect_uri": CALLBACK,
					resource: engine.resource,
					"response_type": "code",
					scope: flow(engine, client).offline ? "mcp offline_access" : "mcp",
					state: `state-${client}`,
				});
				const response = await fetch(`${auth}/oauth2/authorize?${query}`, {
					headers: { accept: "application/json", cookie: person(engine, name).cookie },
					redirect: "manual",
				});
				const body = await response.text();
				const consentPage = response.ok ? new URL(JSON.parse(body).url, engine.baseUrl) : undefined;
				if (consentPage?.pathname !== "/consent") {
					throw new Error(`Authorization did not lead to the consent page: ${response.status} ${body}`);
				}
				flow(engine, client).consentQuery = consentPage.search.slice(1);
			}),
		consents: (name: string, client = name) =>
			step(`${name} grants ${client} consent`, tell, async () => {
				const response = await fetch(`${auth}/oauth2/consent`, {
					body: JSON.stringify({ accept: true, "oauth_query": flow(engine, client).consentQuery }),
					headers: { "content-type": "application/json", cookie: person(engine, name).cookie, origin: engine.baseUrl },
					method: "POST",
					redirect: "manual",
				});
				const body = await response.text();
				const code = response.ok ? new URL(JSON.parse(body).url).searchParams.get("code") : null;
				if (code === null) {
					throw new Error(`Consent returned no authorization code: ${response.status} ${body}`);
				}
				flow(engine, client).code = code;
			}),
		exchangesCode: (client: string) =>
			step(`${client} exchanges the code and its PKCE verifier for an access token`, tell, async () => {
				const response = await fetch(`${auth}/oauth2/token`, {
					body: new URLSearchParams({
						"client_id": flow(engine, client).clientId,
						code: flow(engine, client).code ?? "",
						"code_verifier": verifier(client),
						"grant_type": "authorization_code",
						"redirect_uri": CALLBACK,
						resource: engine.resource,
					}),
					headers: { "content-type": "application/x-www-form-urlencoded" },
					method: "POST",
				});
				const body = await response.text();
				const token: unknown = response.ok ? JSON.parse(body).access_token : undefined;
				if (typeof token !== "string") {
					throw new Error(`The code exchange returned no access token: ${response.status} ${body}`);
				}
				engine.tokens.set(client, token);
				engine.clientIds.set(client, flow(engine, client).clientId);
				const refresh: unknown = JSON.parse(body).refresh_token;
				if (typeof refresh === "string") {
					engine.refreshTokens.set(client, refresh);
				}
			}),
		registersClient: (client: string, offline = false) =>
			step(`${client} registers its callback with the authorization server`, tell, async () => {
				const response = await fetch(`${auth}/oauth2/register`, {
					body: JSON.stringify({
						"application_type": "native",
						"client_name": "Story client",
						"grant_types": offline ? ["authorization_code", "refresh_token"] : ["authorization_code"],
						"redirect_uris": [CALLBACK],
						"response_types": ["code"],
						scope: offline ? "mcp offline_access" : "mcp",
						"token_endpoint_auth_method": "none",
					}),
					headers: { "content-type": "application/json" },
					method: "POST",
				});
				const body = await response.text();
				const clientId: unknown = response.ok ? JSON.parse(body).client_id : undefined;
				if (typeof clientId !== "string") {
					throw new Error(`Registration returned no client id: ${response.status} ${body}`);
				}
				engine.flows.set(client, { clientId, offline });
			}),
	};
}
