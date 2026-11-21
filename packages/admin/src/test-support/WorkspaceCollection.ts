import { Context, Effect, Option } from "effect";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { permissionReadPolicy } from "@shivaedev/contract/permissionReadPolicy.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { adminWorkspacesWire } from "#generated/test-support/WorkspaceCollection.ts";
import { ReadUsers, UsersPermission } from "#permissions.ts";
import { type WorkspaceRow, workspaces } from "#test/workspaceModel.ts";

export class WorkspaceRows extends Context.Service<WorkspaceRows, Effect.Effect<readonly WorkspaceRow[]>>()("@shivaedev/admin/test/WorkspaceRows") {}

const All = query("all", {
	readPolicy: permissionReadPolicy(ReadUsers, (_permission, viewer) =>
		Effect.map(SessionUser, (user) => Option.isSome(viewer) && viewer.value.id === user.id && user.id !== "restricted"),
	),
	reads: () => [],
	readsCollections: [workspaces],
	*run() {
		return yield* yield* WorkspaceRows;
	},
});

export const WorkspaceCollection = defineModule({
	keyScope: "session",
	middleware: UsersPermission,
	name: "admin.workspaces",
	operations: [All],
	wire: adminWorkspacesWire,
});
