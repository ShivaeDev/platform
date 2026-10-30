# MCP tools on the application host

Use `@shivaedev/mcp` to expose native Effect toolkits through the host's existing `routes`. Applications own tool behavior and the permissions that distinguish their audiences. Identity supplies the caller and checks the same grants used by RPC.

```ts
import { Effect, Layer, Schema } from "effect";
import { McpServer, Tool, Toolkit } from "effect/ai";
import { permission } from "@shivaedev/access/permission.ts";
import { Identity } from "@shivaedev/identity/identity.ts";
import { mcpRoutes } from "@shivaedev/mcp/routes.ts";

const ManageTools = permission("admin.tools");
const UserTools = Toolkit.make(Tool.make("whoami", { success: Schema.String, dependencies: [Identity] }));
const AdminTools = Toolkit.make(Tool.make("adminIdentity", { success: Schema.String, dependencies: [Identity] }));
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
const routes = mcpRoutes({
	name: "My app",
	version: "1",
	path: "/mcp",
	sessions: oauth.sessions,
	resourceMetadataUrl: oauth.resourceMetadataUrl,
	audiences: [{ tools: userTools }, { permission: ManageTools.any, tools: adminTools }],
});
```

Grant `ManageTools.any` to the administrator role in the application's `RoleSet`. A signed-in user sees `whoami`; an administrator also sees `adminIdentity`. A user cannot invoke the admin tool by naming it directly, because it is absent from that request's native MCP registry.

Pass `Layer.mergeAll(mounted.routes, oauth.routes, routes)` as `appHost`'s `routes`. `mounted` comes from identity's `betterAuthMount`; `oauth` comes from `betterAuthMcp` in `@shivaedev/mcp/adapters/betterAuth.ts`. The [complete OAuth setup](../../packages/mcp/README.md#connect-oauth-to-identity-and-the-host) includes provider registration, the JWT plugin, roles, discovery routes, login and consent URLs, and the host.

Tools use native `Tool` failure schemas and Effect handlers. Identity and service requirements remain explicit. The endpoint supports MCP `2026-07-28` over request-scoped Streamable HTTP; clients must support this protocol.
