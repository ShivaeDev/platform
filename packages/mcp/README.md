# @shivaedev/mcp

Let AI clients act on application data as the user who connected them. Keep tools in native Effect toolkits, mount them on your application host, and use the same identity and permissions as your contracts.

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

### Connect OAuth to identity and the host

The Better Auth adapter is an optional edge module. Add its provider to the auth instance used by identity, alongside Better Auth's JWT plugin. `mcpProvider` defaults to the `mcp` scope and configures the endpoint's OAuth resource. Pass `scopes: ["mcp", "offline_access"]` to allow refresh tokens; the client must also register the `refresh_token` grant and request `offline_access` during authorization. The application's login and consent pages implement the provider's ordinary UI flow; the provider owns authorization codes, PKCE and tokens.

```ts
import { admin, jwt } from "better-auth/plugins";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";
import { betterAuthOauthGrants } from "@shivaedev/identity/server/better-auth/adapters/oauthGrants.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { trustedOrigins } from "@shivaedev/identity/server/origin.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { betterAuthMcp, mcpProvider } from "@shivaedev/mcp/adapters/betterAuth.ts";
import { mcpRoutes } from "@shivaedev/mcp/routes.ts";
import { appHost } from "@shivaedev/server/appHost.ts";

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

The edge adapter verifies access-token signatures, issuer, endpoint audience and `mcp` scope, then asks identity's `OauthGrants` service to resolve the subject. The identity Better Auth Layer loads the current user and consent and checks `mounted.admitsUser` afresh on every request. Admission changes apply to the next request with the same token. A failed admission lookup answers `503` without an OAuth challenge. Denied or banned users and clients without consent receive the same unauthorized response as invalid tokens. Identity resolves the stored role on each request. An invalid token receives `401` with a `WWW-Authenticate` protected-resource metadata pointer. The metadata names the authorization server and its discovery endpoint, so a client can start OAuth. MCP bearer credentials are separate from browser session cookies. Provide the OAuth policy Layer to the MCP routes before merging them with a cookie-authenticated host.

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

Better Auth is an optional peer of MCP. Identity owns the optional `@better-auth/oauth-provider` peer and its edge exports; MCP's Better Auth adapter uses those exports for provider configuration and discovery. Core `routes.ts` reads identity's `SessionPolicy` from the Effect environment with the same identity and permission semantics. Provide the adapter's `sessions` Layer once through the host, or supply another `SessionPolicy` Layer.

The endpoint uses Effect's request-scoped Streamable HTTP transport and MCP `2026-07-28`. Clients must support that protocol; earlier session-based versions and subscription streams are outside this adapter. Endpoint requests do not share registries, identities or MCP sessions.
