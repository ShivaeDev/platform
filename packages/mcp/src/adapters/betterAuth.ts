import { type OAuthOptions, oauthProvider, oauthProviderAuthServerMetadata, type Scope } from "@better-auth/oauth-provider";
import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import type { AuthContext, BetterAuthOptions } from "better-auth";
import { isAPIError } from "better-auth/api";
import { Effect, Option } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import type { RoleSet } from "@shivaedev/access/roleSet.ts";
import { redact } from "@shivaedev/errors/redact.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { OriginPolicy } from "@shivaedev/identity/server/origin.ts";
import type { SessionPolicy, UserSessionShape } from "@shivaedev/identity/server/session.ts";

export function mcpProvider({
	resource,
	...options
}: Omit<OAuthOptions<Scope[]>, "resources" | "scopes" | "clientRegistrationDefaultResources"> & { readonly resource: string }): ReturnType<
	typeof oauthProvider
> {
	return oauthProvider({ ...options, clientRegistrationDefaultResources: [resource], resources: [resource], scopes: ["mcp"] });
}

interface OauthAuth {
	readonly $context: Promise<{ readonly internalAdapter: Pick<AuthContext["internalAdapter"], "findUserById"> }>;
	readonly api: { readonly "getOAuthServerConfig": () => Promise<{ readonly issuer: string; readonly "jwks_uri"?: string }> };
	readonly options: BetterAuthOptions;
}

function bearerFailure(cause: unknown) {
	if (isAPIError(cause) && (cause.status === "UNAUTHORIZED" || cause.status === "FORBIDDEN")) {
		return Effect.succeed(Option.none());
	}
	return Effect.logError("MCP authentication verification failed", redact(cause)).pipe(
		Effect.andThen(Effect.fail(new AuthUnavailable({ message: "Authentication is temporarily unavailable" }))),
	);
}

export const betterAuthMcp = Effect.fn("Mcp.betterAuthMcp")(function* (options: {
	readonly auth: OauthAuth;
	readonly resource: string;
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
	const client = oauthProviderResourceClient(auth).getActions();
	const sessions: SessionPolicy<UserSessionShape> = {
		origin: options.origin,
		...(options.roles === undefined ? {} : { roles: options.roles }),
		provider: {
			get: (headers) =>
				Effect.gen(function* () {
					const authorization = headers.authorization;
					const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
					const claims = yield* Effect.tryPromise(() =>
						client.verifyBearerToken(token, {
							jwksUrl: config.jwks_uri ?? new URL("/api/auth/jwks", url).href,
							requiredScopes: ["mcp"],
							verifyOptions: { audience: resource, issuer: config.issuer },
						}),
					).pipe(
						Effect.map(Option.some),
						Effect.catch(({ cause }) => bearerFailure(cause)),
					);
					if (Option.isNone(claims) || typeof claims.value.sub !== "string") {
						return Option.none();
					}
					const id = claims.value.sub;
					const user = yield* Effect.tryPromise({
						catch: () => new AuthUnavailable({ message: "OAuth user lookup failed" }),
						try: async () => (await auth.$context).internalAdapter.findUserById(id),
					});
					if (user === null) {
						return Option.none();
					}
					const role: unknown = Reflect.get(user, "role");
					return Option.some({ user: { email: user.email, id: user.id, name: user.name, ...(typeof role === "string" ? { role } : {}) } });
				}),
		},
	};
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
	return { resourceMetadataUrl, routes, sessions };
});
