import { Effect } from "effect";
import { type Engine, person } from "./host.ts";

function clientId(engine: Engine, client: string) {
	const id = engine.clientIds.get(client);
	if (id === undefined) {
		throw new Error(`${client}'s client has no grant`);
	}
	return id;
}

export function grantVerbs(engine: Engine, tell: (line: string) => void) {
	return {
		deletesConsent: (name: string) =>
			Effect.promise(async () => {
				tell(`${name} deletes the client's consent through Better Auth`);
				const headers = new Headers({ cookie: person(engine, name).cookie });
				const consents = await engine.auth.api.getOAuthConsents({ headers });
				const consent = consents.find((entry) => entry.clientId === clientId(engine, name));
				if (consent === undefined) {
					throw new Error(`${name}'s client has no consent`);
				}
				await engine.auth.api.deleteOAuthConsent({ body: { id: consent.id }, headers });
			}),
		hasRefreshToken: (client: string) => Effect.sync(() => typeof engine.refreshTokens.get(client) === "string"),
		refreshes: (client: string) =>
			Effect.promise(async () => {
				tell(`${client}'s client exchanges its refresh token`);
				const token = engine.refreshTokens.get(client);
				if (token === undefined) {
					throw new Error(`${client}'s client has no refresh token`);
				}
				const response = await fetch(`${engine.baseUrl}/api/auth/oauth2/token`, {
					body: new URLSearchParams({
						"client_id": clientId(engine, client),
						"grant_type": "refresh_token",
						"refresh_token": token,
						resource: engine.resource,
					}),
					headers: { "content-type": "application/x-www-form-urlencoded" },
					method: "POST",
				});
				const body = await response.json();
				if (!response.ok) {
					return `${response.status} ${body.error}`;
				}
				engine.tokens.set(client, body.access_token);
				engine.refreshTokens.set(client, body.refresh_token);
				return "refreshed";
			}),
		revokesAllClients: (name: string) =>
			Effect.suspend(() => {
				tell(`${name} revokes every client`);
				return engine.oauth.revokeAllClients(person(engine, name).id);
			}),
		revokesClient: (name: string, client = name) =>
			Effect.suspend(() => {
				tell(`${name} revokes ${client}'s client`);
				return engine.oauth.revokeClient(person(engine, name).id, clientId(engine, client));
			}),
		storedTokenCounts: (client: string) =>
			Effect.promise(async () => {
				const { adapter } = await engine.auth.$context;
				const where = [{ field: "clientId", value: clientId(engine, client) }];
				return {
					access: await adapter.count({ model: "oauthAccessToken", where }),
					refresh: await adapter.count({ model: "oauthRefreshToken", where }),
				};
			}),
	};
}
