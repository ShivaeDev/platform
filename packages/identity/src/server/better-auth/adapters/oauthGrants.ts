import type { AuthContext } from "better-auth";
import { Effect, Layer, Option, Schema } from "effect";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { OauthGrant, OauthGrants } from "#server/oauthGrants.ts";

export interface OauthGrantAuth {
	readonly $context: Promise<{
		readonly adapter: Pick<AuthContext["adapter"], "findOne" | "findMany"> & {
			readonly transaction: <A>(run: (adapter: Pick<AuthContext["adapter"], "deleteMany">) => Promise<A>) => Promise<A>;
		};
		readonly internalAdapter: Pick<AuthContext["internalAdapter"], "findUserById">;
	}>;
}

function unavailable(cause: unknown) {
	return Object.assign(new AuthUnavailable({ message: "OAuth grant storage failed" }), { cause });
}

export function betterAuthOauthGrants(options: {
	readonly auth: OauthGrantAuth;
	readonly admitsUser: (userId: string) => Effect.Effect<boolean, AuthUnavailable>;
}) {
	const { auth, admitsUser } = options;
	const revoke = Effect.fn("Identity.revoke")(function* (userId: string, clientId?: string) {
		yield* Effect.tryPromise({
			catch: unavailable,
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
	return Layer.succeed(OauthGrants, {
		list: Effect.fn("OauthGrants.list")(function* (userId: string, page: { readonly limit: number; readonly offset?: number }) {
			const consents = yield* Effect.tryPromise({
				catch: unavailable,
				try: async () => {
					const { adapter } = await auth.$context;
					return adapter.findMany({
						...page,
						model: "oauthConsent",
						sortBy: { direction: "asc", field: "id" },
						where: [{ field: "userId", value: userId }],
					});
				},
			});
			return yield* Schema.decodeUnknownEffect(Schema.Array(OauthGrant))(consents).pipe(Effect.mapError(unavailable));
		}),
		resolveSubject: Effect.fn("OauthGrants.resolveSubject")(function* (userId: string, clientId: string) {
			const subject = yield* Effect.tryPromise({
				catch: unavailable,
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
			if (subject === null || !(yield* admitsUser(subject.id))) {
				return Option.none();
			}
			const role: unknown = Reflect.get(subject, "role");
			return Option.some({ email: subject.email, id: subject.id, name: subject.name, ...(typeof role === "string" ? { role } : {}) });
		}),
		revokeAllClients: (userId) => revoke(userId),
		revokeClient: (userId, clientId) => revoke(userId, clientId),
	});
}
