import { type OAuthOptions, oauthProvider, oauthProviderAuthServerMetadata, type Scope } from "@better-auth/oauth-provider";
import { Effect } from "effect";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";

export type OauthResourceOptions = Omit<OAuthOptions<Scope[]>, "resources" | "clientRegistrationDefaultResources"> & { readonly resource: string };

export function betterAuthOauthProvider({ resource, ...options }: OauthResourceOptions): ReturnType<typeof oauthProvider> {
	return oauthProvider({ ...options, clientRegistrationDefaultResources: [resource], resources: [resource] });
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
