# @shivaedev/mcp

Let AI clients act on application data as the user who connected them. Keep tools in native Effect toolkits, mount them on your application host, and use the same identity and permissions as your contracts.

## Tools for each audience

A signed-in user discovers user tools. An administrator also discovers admin tools. A plain user cannot call a hidden admin tool by guessing its name.

```ts
const routes = mcpRoutes({
	name: "My app",
	version: "1",
	path: "/mcp",
	sessions: oauth.sessions,
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

The Better Auth adapter is an optional edge module. Add its provider to the auth instance used by identity, alongside Better Auth's JWT plugin. `mcpProvider` configures the `mcp` scope and the endpoint's OAuth resource. The application's login and consent pages implement the provider's ordinary UI flow; the provider owns authorization codes, PKCE and tokens.

```ts
import { admin, jwt } from "better-auth/plugins";
import { Effect, Layer } from "effect";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { trustedOrigins } from "@shivaedev/identity/server/origin.ts";
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
	const oauth = yield* betterAuthMcp({ auth: mounted.auth, resource, origin, roles: Roles });
	return appHost({
		group: Api,
		handlers: Handlers,
		sessions: { ...mounted.sessions, origin },
		routes: Layer.mergeAll(
			mounted.routes,
			oauth.routes,
			mcpRoutes({
				name: "My app",
				version: "1",
				path: "/mcp",
				sessions: oauth.sessions,
				resourceMetadataUrl: oauth.resourceMetadataUrl,
				audiences: [{ tools: userTools }, { permission: ManageTools.any, tools: adminTools }],
			}),
		),
	});
});
```

`authPool`, `Api` and `Handlers` are the application's existing auth database, RPC group and handlers. Run the Better Auth migrations with the OAuth and JWT plugins included. For existing role management, keep the application's existing role plugin and `RoleSet` in this configuration.

The edge adapter verifies access-token signatures, issuer, endpoint audience and `mcp` scope, then loads the current user through Better Auth. Identity resolves the stored role on each request. An invalid token receives `401` with a `WWW-Authenticate` protected-resource metadata pointer. The metadata names the authorization server and its discovery endpoint, so a client can start OAuth. MCP bearer credentials are separate from browser session cookies.

### Install and limits

```sh
pnpm add @shivaedev/mcp effect
pnpm add better-auth @better-auth/oauth-provider
```

The OAuth dependencies are optional peers, imported only by `adapters/betterAuth.ts`. Core `routes.ts` also accepts another identity `SessionPolicy` with the same identity and permission semantics.

The endpoint uses Effect's request-scoped Streamable HTTP transport and MCP `2026-07-28`. Clients must support that protocol; earlier session-based versions and subscription streams are outside this adapter. Endpoint requests do not share registries, identities or MCP sessions.

The package's stories run through `appHost` over loopback HTTP with Better Auth on PostgreSQL. They cover user and admin discovery and calls, refused hidden tools, OAuth discovery, token audience and scope, typed tool failures, and an authorization-code connection with consent and PKCE. They do not establish compatibility with a particular desktop client.
