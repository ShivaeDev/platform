import { Effect, Layer, Schema } from "effect";
import { McpServer, Tool, Toolkit } from "effect/ai";
import { permission } from "@shivaedev/access/permission.ts";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { Identity } from "@shivaedev/identity/identity.ts";

export const Access = permission("admin.tools");
export const Roles = roleSet(role("admin", [Access.any]), role("user", []));
export class Refused extends Schema.TaggedError<Refused>()("Refused", { message: Schema.String }) {}
export const UserTools = Toolkit.make(Tool.make("whoami", { dependencies: [Identity], success: Schema.String }));
export const AdminTools = Toolkit.make(
	Tool.make("adminOnly", { dependencies: [Identity], success: Schema.String }),
	Tool.make("refuse", { failure: Refused }),
);
export const audiences = [
	{ tools: McpServer.toolkit(UserTools).pipe(Layer.provide(UserTools.toLayer({ whoami: () => Effect.map(Identity, ({ id }) => id) }))) },
	{
		permission: Access.any,
		tools: McpServer.toolkit(AdminTools).pipe(
			Layer.provide(
				AdminTools.toLayer({
					adminOnly: () => Effect.map(Identity, ({ id }) => `admin:${id}`),
					refuse: () => Effect.fail(new Refused({ message: "Application refused" })),
				}),
			),
		),
	},
];
