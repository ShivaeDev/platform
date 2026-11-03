import type { AuthContext } from "better-auth";
import { Clock, Effect } from "effect";

interface McpAuth {
	readonly $context: Promise<{ readonly adapter: Pick<AuthContext["adapter"], "create"> }>;
	readonly api: {
		readonly "getOAuthServerConfig": () => Promise<{ readonly issuer: string }>;
		readonly "signJWT": (input: { readonly body: { readonly payload: Record<string, string | number> } }) => Promise<{ readonly token: string }>;
	};
}

export const mcpBearerToken = Effect.fnUntraced(function* (
	auth: McpAuth,
	{ userId, clientId, resource }: { readonly userId: string; readonly clientId: string; readonly resource: string },
): Effect.fn.Return<{ readonly grantId: string; readonly headers: Headers; readonly token: string }> {
	const { adapter } = yield* Effect.promise(() => auth.$context);
	const { issuer } = yield* Effect.promise(() => auth.api.getOAuthServerConfig());
	const now = yield* Clock.currentTimeMillis;
	const grant = yield* Effect.promise(() =>
		adapter.create<{ id: string }>({
			data: { clientId, createdAt: new Date(now), scopes: ["mcp"], updatedAt: new Date(now), userId },
			model: "oauthConsent",
		}),
	);
	const { token } = yield* Effect.promise(() =>
		auth.api.signJWT({
			body: {
				payload: {
					aud: resource,
					"client_id": clientId,
					exp: Math.floor(now / 1000) + 3600,
					"grant_id": grant.id,
					iat: Math.floor(now / 1000),
					iss: issuer,
					scope: "mcp",
					sub: userId,
				},
			},
		}),
	);
	return { grantId: grant.id, headers: new Headers({ authorization: `Bearer ${token}` }), token };
});
