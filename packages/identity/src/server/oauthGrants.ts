import { Context, type Effect, type Option, Schema } from "effect";
import type { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { SessionUserValue } from "#identity.ts";

export const OauthGrant = Schema.Struct({ clientId: Schema.String, scopes: Schema.Array(Schema.String) });
export type OauthGrant = typeof OauthGrant.Type;

export class OauthGrants extends Context.Service<
	OauthGrants,
	{
		readonly list: (
			userId: string,
			page: { readonly limit: number; readonly offset?: number },
		) => Effect.Effect<readonly OauthGrant[], AuthUnavailable>;
		readonly revokeClient: (userId: string, clientId: string) => Effect.Effect<void, AuthUnavailable>;
		readonly revokeAllClients: (userId: string) => Effect.Effect<void, AuthUnavailable>;
		readonly resolveSubject: (userId: string, clientId: string) => Effect.Effect<Option.Option<SessionUserValue>, AuthUnavailable>;
	}
>()("@shivaedev/identity/OauthGrants") {}
