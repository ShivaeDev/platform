import {
	type OAuthClaimExtensionInput,
	type OAuthOptions,
	oauthProvider,
	oauthProviderAuthServerMetadata,
	type Scope,
} from "@better-auth/oauth-provider";
import { APIError } from "better-auth/api";
import { Effect } from "effect";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";

export type OauthResourceOptions = Omit<OAuthOptions<Scope[]>, "resources" | "clientRegistrationDefaultResources"> & { readonly resource: string };

async function grantClaims({ ctx, user, client, referenceId }: OAuthClaimExtensionInput) {
	if (!user) {
		return {};
	}
	const consent = await ctx.context.adapter.findOne<{ id: string }>({
		model: "oauthConsent",
		where: [
			{ field: "userId", value: user.id },
			{ field: "clientId", value: client.clientId },
			{ field: "referenceId", value: referenceId ?? null },
		],
	});
	if (consent === null) {
		throw new APIError("BAD_REQUEST", { error: "invalid_grant", "error_description": "Consent is required" });
	}
	return { "grant_id": consent.id };
}

export function betterAuthOauthProvider({ resource, ...options }: OauthResourceOptions): ReturnType<typeof oauthProvider> {
	return oauthProvider({
		...options,
		clientRegistrationDefaultResources: [resource],
		extensions: [...(options.extensions ?? []), { claims: { accessToken: grantClaims } }],
		resources: [resource],
	});
}

export const oauthAuthorizationMetadata = Effect.fn("Identity.oauthAuthorizationMetadata")(function* (
	auth: { readonly api: { readonly "getOAuthServerConfig": (input: { readonly request: Request; readonly asResponse: false }) => Promise<unknown> } },
	request: Request,
) {
	return yield* Effect.tryPromise({
		catch: (cause) => Object.assign(new AuthUnavailable({ message: "OAuth server metadata failed" }), { cause }),
		try: () => oauthProviderAuthServerMetadata(auth)(request),
	});
});
