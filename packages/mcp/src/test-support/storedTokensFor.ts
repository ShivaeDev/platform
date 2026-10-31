import { DateTime, Effect } from "effect";
import { person } from "./host.ts";
import { mcp } from "./mcp.ts";

export function storedTokensFor(name: string, client = name) {
	return mcp.trait("tokens", `${name}'s ${client} client has two stored access and refresh tokens`, function* (engine) {
		// Opaque token rows exercise deletion independently of the provider's JWT issuance.
		const { adapter } = yield* Effect.promise(() => engine.auth.$context);
		const now = DateTime.toDateUtc(yield* DateTime.now);
		const grant = { clientId: engine.clientIds.get(client), createdAt: now, expiresAt: now, scopes: ["mcp"], userId: person(engine, name).id };
		for (const index of [1, 2]) {
			const refresh = yield* Effect.promise(() =>
				adapter.create<{ id: string }>({ data: { ...grant, token: `${client}-refresh-${index}` }, model: "oauthRefreshToken" }),
			);
			yield* Effect.promise(() =>
				adapter.create({ data: { ...grant, refreshId: refresh.id, token: `${client}-access-${index}` }, model: "oauthAccessToken" }),
			);
		}
	});
}
