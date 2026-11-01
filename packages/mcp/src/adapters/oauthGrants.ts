import type { AuthContext, BetterAuthOptions } from "better-auth";
import { Effect } from "effect";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";

export interface OauthAuth {
	readonly $context: Promise<{
		readonly adapter: Pick<AuthContext["adapter"], "findOne"> & {
			readonly transaction: <A>(run: (adapter: Pick<AuthContext["adapter"], "deleteMany">) => Promise<A>) => Promise<A>;
		};
		readonly internalAdapter: Pick<AuthContext["internalAdapter"], "findUserById">;
	}>;
	readonly api: { readonly "getOAuthServerConfig": () => Promise<{ readonly issuer: string; readonly "jwks_uri"?: string }> };
	readonly options: BetterAuthOptions;
}

export function oauthGrants(auth: OauthAuth) {
	const revoke = Effect.fn("Mcp.revoke")(function* (userId: string, clientId?: string) {
		yield* Effect.tryPromise({
			catch: (cause) => Object.assign(new AuthUnavailable({ message: "OAuth grant revocation failed" }), { cause }),
			try: async () => {
				const { adapter } = await auth.$context;
				const where = [{ field: "userId", value: userId }, ...(clientId === undefined ? [] : [{ field: "clientId", value: clientId }])];
				await adapter.transaction(async (transaction) => {
					for (const model of ["oauthConsent", "oauthAccessToken", "oauthRefreshToken"]) {
						await transaction.deleteMany({ model, where });
					}
				});
			},
		});
	});
	return {
		revokeAllClients: (userId: string) => revoke(userId),
		revokeClient: (userId: string, clientId: string) => revoke(userId, clientId),
	};
}

export const grantedUser = Effect.fn("Mcp.grantedUser")(function* (auth: OauthAuth, userId: string, clientId: string) {
	return yield* Effect.tryPromise({
		catch: (cause) => Object.assign(new AuthUnavailable({ message: "OAuth grant lookup failed" }), { cause }),
		try: async () => {
			const { adapter, internalAdapter } = await auth.$context;
			const user = await internalAdapter.findUserById(userId);
			if (user === null || Reflect.get(user, "banned") === true) {
				return null;
			}
			const consent = await adapter.findOne({
				model: "oauthConsent",
				where: [
					{ field: "userId", value: userId },
					{ field: "clientId", value: clientId },
				],
			});
			return consent === null ? null : user;
		},
	});
});
