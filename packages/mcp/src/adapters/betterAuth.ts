import { Effect, Layer, Option } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import type { RoleSet } from "@shivaedev/access/roleSet.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import {
	betterAuthOauthProvider,
	type OauthResourceOptions,
	oauthAuthorizationMetadata,
} from "@shivaedev/identity/server/better-auth/adapters/oauthProvider.ts";
import { OauthGrants } from "@shivaedev/identity/server/oauthGrants.ts";
import type { OriginPolicy } from "@shivaedev/identity/server/origin.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { bearer, type JwksSource } from "./bearer.ts";

export function mcpProvider({ scopes = ["mcp"], ...options }: OauthResourceOptions): ReturnType<typeof betterAuthOauthProvider> {
	return betterAuthOauthProvider({ ...options, scopes });
}

export const betterAuthMcp = Effect.fn("Mcp.betterAuthMcp")(function* (options: {
	readonly auth: {
		readonly api: { readonly "getOAuthServerConfig": () => Promise<{ readonly issuer: string; readonly "jwks_uri"?: string }> };
	};
	readonly resource: string;
	readonly jwks?: JwksSource;
	readonly origin: OriginPolicy;
	readonly roles?: RoleSet;
}) {
	const config = yield* Effect.tryPromise({
		catch: (cause) => Object.assign(new AuthUnavailable({ message: "OAuth provider configuration failed" }), { cause }),
		try: () => options.auth.api.getOAuthServerConfig(),
	});
	const grants = yield* OauthGrants;
	const { auth, resource } = options;
	const url = new URL(resource);
	const metadataPath = `/.well-known/oauth-protected-resource${url.pathname}` as const;
	const resourceMetadataUrl = new URL(metadataPath, url).href;
	const authorizationMetadataPath = `/.well-known/oauth-authorization-server${new URL(config.issuer).pathname.replace(/\/$/u, "")}` as const;
	const verify = bearer(options.jwks ?? config.jwks_uri ?? new URL("/api/auth/jwks", url).href, resource, config.issuer);
	const sessions = Layer.succeed(SessionPolicy, {
		origin: options.origin,
		...(options.roles === undefined ? {} : { roles: options.roles }),
		provider: {
			get: (headers) =>
				Effect.gen(function* () {
					const authorization = headers.authorization;
					const token = authorization?.match(/^Bearer (?<token>.+)$/iu)?.groups?.token;
					const claims = yield* verify(token);
					if (Option.isNone(claims) || typeof claims.value.sub !== "string" || typeof claims.value.client_id !== "string") {
						return Option.none();
					}
					const subject = yield* grants.resolveSubject(claims.value.sub, claims.value.client_id);
					return Option.map(subject, (user) => ({ user }));
				}),
		},
	});
	const authorizationMetadata = Effect.fn("Mcp.authorizationMetadata")(function* (request: HttpServerRequest.HttpServerRequest) {
		const web = yield* HttpServerRequest.toWeb(request);
		return HttpServerResponse.fromWeb(yield* oauthAuthorizationMetadata(auth, web));
	});
	const routes = HttpRouter.use((router) =>
		Effect.gen(function* () {
			yield* router.add(
				"GET",
				metadataPath,
				HttpServerResponse.jsonUnsafe({ "authorization_servers": [config.issuer], resource, "scopes_supported": ["mcp"] }),
			);
			yield* router.add("GET", authorizationMetadataPath, authorizationMetadata);
		}),
	);
	return { resourceMetadataUrl, routes, sessions };
});
