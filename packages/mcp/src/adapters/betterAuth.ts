import { type OAuthOptions, oauthProvider, oauthProviderAuthServerMetadata, type Scope } from "@better-auth/oauth-provider";
import { Effect, Layer, Option } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import type { RoleSet } from "@shivaedev/access/roleSet.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { OriginPolicy } from "@shivaedev/identity/server/origin.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { bearer, type JwksSource } from "./bearer.ts";
import { grantedUser, type OauthAuth, oauthGrants } from "./oauthGrants.ts";

export function mcpProvider({
	resource,
	scopes = ["mcp"],
	...options
}: Omit<OAuthOptions<Scope[]>, "resources" | "clientRegistrationDefaultResources"> & { readonly resource: string }): ReturnType<
	typeof oauthProvider
> {
	return oauthProvider({ ...options, clientRegistrationDefaultResources: [resource], resources: [resource], scopes });
}

export const betterAuthMcp = Effect.fn("Mcp.betterAuthMcp")(function* (options: {
	readonly admitsUser: (userId: string) => Effect.Effect<boolean, AuthUnavailable>;
	readonly auth: OauthAuth;
	readonly resource: string;
	readonly jwks?: JwksSource;
	readonly origin: OriginPolicy;
	readonly roles?: RoleSet;
}) {
	const config = yield* Effect.tryPromise({
		catch: () => new AuthUnavailable({ message: "OAuth provider configuration failed" }),
		try: () => options.auth.api.getOAuthServerConfig(),
	});
	const { auth, resource } = options;
	const url = new URL(resource);
	const metadataPath = `/.well-known/oauth-protected-resource${url.pathname}` as const;
	const resourceMetadataUrl = new URL(metadataPath, url).href;
	const verify = bearer(options.jwks ?? config.jwks_uri ?? new URL("/api/auth/jwks", url).href, resource, config.issuer);
	const sessions = Layer.succeed(SessionPolicy, {
		origin: options.origin,
		...(options.roles === undefined ? {} : { roles: options.roles }),
		provider: {
			get: (headers) =>
				Effect.gen(function* () {
					const authorization = headers.authorization;
					const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
					const claims = yield* verify(token);
					if (Option.isNone(claims) || typeof claims.value.sub !== "string" || typeof claims.value.client_id !== "string") {
						return Option.none();
					}
					const user = yield* grantedUser(auth, claims.value.sub, claims.value.client_id);
					if (user === null || !(yield* options.admitsUser(user.id))) {
						return Option.none();
					}
					const role: unknown = Reflect.get(user, "role");
					return Option.some({ user: { email: user.email, id: user.id, name: user.name, ...(typeof role === "string" ? { role } : {}) } });
				}),
		},
	});
	const metadata = oauthProviderAuthServerMetadata(auth);
	const authorizationMetadata = Effect.fn("Mcp.authorizationMetadata")(function* (request: HttpServerRequest.HttpServerRequest) {
		const web = yield* HttpServerRequest.toWeb(request);
		return HttpServerResponse.fromWeb(yield* Effect.promise(() => metadata(web)));
	});
	const routes = HttpRouter.use((router) =>
		Effect.gen(function* () {
			yield* router.add(
				"GET",
				metadataPath,
				HttpServerResponse.jsonUnsafe({ "authorization_servers": [config.issuer], resource, "scopes_supported": ["mcp"] }),
			);
			yield* router.add("GET", "/.well-known/oauth-authorization-server/api/auth", authorizationMetadata);
		}),
	);
	return { ...oauthGrants(auth), resourceMetadataUrl, routes, sessions };
});
