import { DateTime, Effect } from "effect";
import { oauthGrants } from "#test/better-auth/oauthGrants.ts";

export const existingGrants = oauthGrants.trait(
	"grants",
	"alice and bob already consented to desktop and phone clients with stored tokens",
	function* (engine) {
		const { adapter } = yield* Effect.promise(() => engine.auth.$context);
		const now = DateTime.toDateUtc(yield* DateTime.now);
		const expiresAt = new Date(now.getTime() + 3_600_000);
		// Minted grants isolate identity's lifecycle from the provider's OAuth flow.
		for (const clientId of ["desktop", "phone"]) {
			yield* Effect.promise(() => adapter.create({ data: { clientId, redirectUris: ["http://localhost/callback"] }, model: "oauthClient" }));
			for (const userId of engine.people.values()) {
				const consent = yield* Effect.promise(() =>
					adapter.create<{ id: string }>({ data: { clientId, createdAt: now, scopes: ["mcp"], updatedAt: now, userId }, model: "oauthConsent" }),
				);
				engine.grantIds.set(`${userId}-${clientId}`, consent.id);
				for (const [index, model] of [
					[1, "oauthAccessToken"],
					[2, "oauthAccessToken"],
					[1, "oauthRefreshToken"],
					[2, "oauthRefreshToken"],
				] as const) {
					yield* Effect.promise(() =>
						adapter.create({
							data: { clientId, createdAt: now, expiresAt, scopes: ["mcp"], token: `${userId}-${clientId}-${model}-${index}`, userId },
							model,
						}),
					);
				}
			}
		}
	},
);
