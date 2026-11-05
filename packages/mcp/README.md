# @shivaedev/mcp

Let AI clients act on application data through native Effect toolkits. Mount them on your application host with the same identity and permissions as your contracts, or serve them locally over stdio.

## Tools for each audience

A signed-in user discovers user tools. An administrator also discovers admin tools. A plain user cannot call a hidden admin tool by guessing its name.

```ts
const routes = mcpRoutes({
	name: "My app",
	version: "1",
	path: "/mcp",
	resourceMetadataUrl: oauth.resourceMetadataUrl,
	audiences: [{ tools: userTools }, { permission: ManageTools.any, tools: adminTools }],
});
```

## Using it

Each request authenticates through identity's session policy. The route registers only the caller's permitted audiences with Effect's `McpServer`; discovery and dispatch use that same registry. Handlers receive `Identity` and `SessionUser` from the current request. A shared application Layer never retains a caller's identity.

### Declare native tools and handlers

Use `Tool` and `Toolkit` from `effect/ai`. Declare handler dependencies and failure schemas on the tool, just as contracts declare dependencies and typed failures. Platform does not add another tool definition or handler API.

```ts
import { Effect, Layer, Schema } from "effect";
import { McpServer, Tool, Toolkit } from "effect/ai";
import { permission } from "@shivaedev/access/permission.ts";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { Identity } from "@shivaedev/identity/identity.ts";

const ManageTools = permission("admin.tools");
const Roles = roleSet(role("user", []), role("admin", [ManageTools.any]));
const UserTools = Toolkit.make(
	Tool.make("whoami", {
		success: Schema.String,
		dependencies: [Identity],
	}),
);
const AdminTools = Toolkit.make(
	Tool.make("adminIdentity", {
		success: Schema.String,
		dependencies: [Identity],
	}),
);
const userTools = McpServer.toolkit(UserTools).pipe(
	Layer.provide(
		UserTools.toLayer({
			whoami: () => Effect.map(Identity, ({ id }) => id),
		}),
	),
);
const adminTools = McpServer.toolkit(AdminTools).pipe(
	Layer.provide(
		AdminTools.toLayer({
			adminIdentity: () => Effect.map(Identity, ({ id }) => id),
		}),
	),
);
```

Application roles and grants come from `@shivaedev/access`; identity resolves the current stored role and checks those grants. An audience without a permission is available to every signed-in caller. Add `failure: YourErrorSchema` to a tool and return that failure in its Effect handler; native MCP error results carry the declared failure.

### Run a local stdio server

Use `mcpStdio` from `@shivaedev/mcp/stdio.ts` when an MCP client starts your integration as a child process. Pass the same native toolkit Layer used for HTTP; combine several toolkits with `Layer.mergeAll`. Provide the handlers' application services through Layers.

```ts
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer, Logger } from "effect";
import { McpServer } from "effect/ai";
import { Identity } from "@shivaedev/identity/identity.ts";
import { mcpStdio } from "@shivaedev/mcp/stdio.ts";

const localUser = McpServer.middleware<{ provides: Identity }>()((effect) => Effect.provideService(effect, Identity, { id: "local-user" }));

mcpStdio({ name: "Local integration", version: "1", tools: userTools.pipe(Layer.provide(localUser.layer)) }).pipe(
	Layer.launch,
	Effect.provideService(Logger.LogToStderr, true),
	Effect.provide(NodeServices.layer),
	NodeRuntime.runMain,
);
```

`userTools` is the toolkit Layer declared above. The stdio entry point requires Effect's `Stdio` service, supplied here by `NodeServices.layer` from `@effect/platform-node`. Keep stdout for MCP messages and direct application logs to stderr. The server supports MCP `2026-07-28` and `2025-11-25` over newline-delimited JSON-RPC. Its Layer scope owns the transport and handlers: cancelling a tool call releases its scoped resources, and closing the client stops the child process and releases in-flight tool resources.

Stdio uses the services supplied by the local application. It does not run the HTTP session policy or select permission-based audiences; the application chooses which toolkits to serve and supplies the identity its tools read. Services a tool declares in `dependencies` are request-level in Effect's `McpServer`: supply them through `McpServer.middleware` provided to the toolkit Layer, as `localUser` does here, because `Layer.provide` with the service itself does not satisfy them.

### Connect OAuth to identity and the host

The Better Auth adapter is an optional edge module. Add its provider to the auth instance used by identity, alongside Better Auth's JWT plugin. `mcpProvider` defaults to the `mcp` scope and configures the endpoint's OAuth resource. Pass `scopes: ["mcp", "offline_access"]` to allow refresh tokens; the client must also register the `refresh_token` grant and request `offline_access` during authorization. The application's login and consent pages implement the provider's ordinary UI flow; the provider owns authorization codes, PKCE and tokens.

```ts
import { admin, jwt } from "better-auth/plugins";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/adapters/mount.ts";
import { betterAuthOauthGrants } from "@shivaedev/identity/server/better-auth/adapters/oauthGrants.ts";
import { trustedOrigins } from "@shivaedev/identity/server/adapters/trustedOrigins.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { betterAuthMcp, mcpProvider } from "@shivaedev/mcp/adapters/betterAuth.ts";
import { mcpRoutes } from "@shivaedev/mcp/routes.ts";
import { appHost } from "@shivaedev/server/appDatabase.ts";

const application = Effect.gen(function* () {
	const resource = "https://app.example.com/mcp";
	const mounted = yield* betterAuthMount(
		{
			baseURL: "https://app.example.com",
			database: authPool,
			plugins: [
				jwt(),
				mcpProvider({
					resource,
					loginPage: "/login",
					consentPage: "/consent",
					allowDynamicClientRegistration: true,
					allowUnauthenticatedClientRegistration: true,
				}),
			],
		},
		{ roles: Roles },
	);
	const origin = trustedOrigins({ allow: ["https://app.example.com"], missing: "allow" });
	const grants = betterAuthOauthGrants({ auth: mounted.auth, admitsUser: mounted.admitsUser });
	const oauth = yield* betterAuthMcp({ auth: mounted.auth, resource, origin, roles: Roles }).pipe(Effect.provide(grants));
	return appHost({
		group: Api,
		handlers: Handlers,
		sessions: Layer.succeed(SessionPolicy, { ...mounted.sessions, origin }),
		routes: Layer.mergeAll(
			mounted.routes,
			oauth.routes,
			mcpRoutes({
				name: "My app",
				version: "1",
				path: "/mcp",
				resourceMetadataUrl: oauth.resourceMetadataUrl,
				audiences: [{ tools: userTools }, { permission: ManageTools.any, tools: adminTools }],
			}).pipe(HttpRouter.provideRequest(oauth.sessions)),
		),
	});
});
```

`authPool`, `Api` and `Handlers` are the application's existing auth database, RPC group and handlers. Run the Better Auth migrations with the OAuth and JWT plugins included. For existing role management, keep the application's existing role plugin and `RoleSet` in this configuration.

The edge adapter verifies access-token signatures, issuer, endpoint audience, `mcp` scope and the `grant_id` reference, then asks identity’s `OauthGrants` service to resolve that exact grant. The identity Better Auth Layer loads the current user and referenced consent, requires `mcp` in the consent’s current scopes and checks `mounted.admitsUser` afresh on every request. Admission changes apply to the next request with the same token. A failed admission lookup answers `503` without an OAuth challenge. Denied or banned users and clients without the referenced consent receive the same unauthorized response as invalid tokens. Identity resolves the stored role on each request. An invalid token receives `401` with a `WWW-Authenticate` protected-resource metadata pointer. The metadata names the authorization server and its discovery endpoint, so a client can start OAuth. MCP bearer credentials are separate from browser session cookies. The OAuth session policy refuses requests carrying a Cookie header, including requests that also carry a valid bearer token. Provide the OAuth policy Layer to the MCP routes before merging them with a cookie-authenticated host.

### Diagnose token refusals

`betterAuthMcp` returns `authenticate(token)` alongside its route and session Layers. It verifies the token and resolves its current OAuth grant. A successful authentication returns `Option.some({ user })`; a refused grant returns `Option.none()`. Missing or malformed `iss`, `aud`, `sub`, `client_id` or `scope` claims fail with `InvalidTokenClaim` from `@shivaedev/mcp/adapters/InvalidTokenClaim.ts`. The failure names `claim`, and the adapter logs a warning with that name. Claims and token values stay out of this diagnostic. Blank subjects and client identifiers are invalid too.

Use `authenticate` in application stories to distinguish invalid claims from refused grants. HTTP sessions translate `InvalidTokenClaim` into the ordinary `401` resource challenge. A token with an invalid signature still receives that challenge; verification infrastructure failures remain `AuthUnavailable` and answer `503`.

### Manage client grants

Identity owns grant listing and revocation through its [`OauthGrants` service](https://github.com/ShivaeDev/platform/tree/main/packages/identity#oauth-grants). Provide `betterAuthOauthGrants({ auth: mounted.auth, admitsUser: mounted.admitsUser })` to Effects that use that service. The application authorizes grant management operations.

### Dynamic origins and local keys

When Better Auth uses a dynamic `baseURL`, give it a `fallback`, for example `{ allowedHosts: ["app.example.com"], fallback: "https://app.example.com" }`. The adapter loads OAuth metadata outside a request, so Better Auth needs that origin to determine the issuer.

By default verification fetches the authorization server's JWKS URL. Pass `jwks` to use an in-process public key source instead, including on story hosts whose public origin has no HTTP route:

```ts
const oauth = yield* betterAuthMcp({
	auth: mounted.auth,
	resource,
	origin,
	roles: Roles,
	jwks: () => mounted.auth.api.getJwks(),
}).pipe(Effect.provide(grants));
```

The callback returns the public JWK set from the JWT plugin. Signature, issuer, audience and `mcp` scope checks still apply. Signing keys stay with the auth instance.

### Install and limits

```sh
pnpm add @shivaedev/mcp effect
pnpm add better-auth @better-auth/oauth-provider
```

Better Auth is an optional peer of MCP. Identity owns the optional `@better-auth/oauth-provider` peer and its edge exports; MCP's Better Auth adapter uses those exports for provider configuration and discovery. Core `routes.ts` reads identity's `SessionPolicy` from the Effect environment with the same identity and permission semantics; it runs without either OAuth peer installed. Provide the adapter's `sessions` Layer once through the host, or supply another `SessionPolicy` Layer.

The endpoint uses Effect's request-scoped Streamable HTTP transport and MCP `2026-07-28`. Clients must support that protocol; earlier session-based versions and subscription streams are outside this adapter. Endpoint requests do not share registries, identities or MCP sessions. For browser clients, both the session policy's `origin` and the route's `allowedOrigins` must accept the Origin; non-browser clients can omit Origin when the session policy allows it.
