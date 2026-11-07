import { DateTime, Effect } from "effect";
import { connects } from "#test/client.ts";
import { hashGrantToken } from "#test/hashGrantToken.ts";
import { person } from "#test/host.ts";
import { mcp } from "#test/mcp.ts";
import { oauthVerbs } from "#test/oauthVerbs.ts";
import { holdsToken } from "#test/traits.ts";

export function consentedClient(name: string, client = name, offline = false) {
	return mcp.trait("tokens", `${name} has consented to ${client}${offline ? " with offline access" : ""}`, function* (engine) {
		const oauth = oauthVerbs(engine, () => undefined);
		yield* oauth.registersClient(client, offline);
		yield* oauth.authorizes(name, client);
		yield* oauth.consents(name, client);
	});
}

function connectedClient(client: string) {
	return mcp.trait("connections", `${client} is connected with its grant`, function* (engine) {
		const outcome = yield* connects(engine, client);
		if (outcome !== "connected") {
			throw new Error(`${client} could not connect: ${outcome}`);
		}
	});
}

export function refreshableClient(name: string, client = name) {
	const refreshGrant = mcp.trait("tokens", `${name}'s ${client} already has a minted refresh grant`, function* (engine) {
		const { adapter } = yield* Effect.promise(() => engine.auth.$context);
		const clientId = engine.clientIds.get(client) ?? "";
		const token = `${client}-refresh-token`;
		const now = DateTime.toDateUtc(yield* DateTime.now);
		yield* Effect.promise(async () => {
			await adapter.create({ data: { clientId, resourceId: engine.resource }, model: "oauthClientResource" });
			await adapter.update({
				model: "oauthClient",
				update: { grantTypes: ["authorization_code", "refresh_token"], scopes: ["mcp", "offline_access"], tokenEndpointAuthMethod: "none" },
				where: [{ field: "clientId", value: clientId }],
			});
			await adapter.create({
				data: {
					clientId,
					createdAt: now,
					expiresAt: new Date(now.getTime() + 3_600_000),
					resources: [engine.resource],
					scopes: ["mcp", "offline_access"],
					token: hashGrantToken(token),
					userId: person(engine, name).id,
				},
				model: "oauthRefreshToken",
			});
		});
		engine.refreshTokens.set(client, token);
	});
	return mcp.traits(holdsToken(name, "for this endpoint", client), refreshGrant, connectedClient(client));
}
