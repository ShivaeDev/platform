import { Effect, Schema } from "effect";
import { permission } from "@shivaedev/access/permission.ts";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { permissionMiddleware } from "@shivaedev/identity/permission.ts";
import { adminPage } from "#page.ts";
import { ReadUsers, UsersPermission } from "#permissions.ts";
import { adminRegistry } from "#registry.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import { Users } from "./pages.ts";

export const ReadWorkspaces = permission("workspaces.read");
class WorkspacesPermission extends permissionMiddleware<WorkspacesPermission>()("test/WorkspacesPermission", ReadWorkspaces) {}
export const WorkspaceAccess = roleSet(role("workspace-reader", [ReadWorkspaces]), role("auditor", [ReadUsers]), role("viewer", []));
export type WorkspaceRole = typeof WorkspaceAccess.Role.Type;
export const Workspaces = adminPage({
	contract: contract("admin.workspaces", {
		queries: [query("read", { payload: { id: Schema.String }, readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.String })],
	}),
	id: "workspaces",
	permission: WorkspacesPermission,
	route: { detail: "/admin/workspaces/$id/", path: "/admin/workspaces", title: "Workspaces" },
});
const WorkspaceExports = adminPage({
	contract: contract("admin.exports", {
		queries: [query("read", { readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.String })],
	}),
	id: "exports",
	permission: UsersPermission,
	route: { path: "/admin/exports", title: "Exports" },
});
export const workspaceRegistration = registerAdmin(adminRegistry(Workspaces, Users, WorkspaceExports), {
	exports: WorkspaceExports.contract.application.toLayer({ "admin.exports.read": () => Effect.succeed("exports") }),
	users: Users.contract.application.toLayer({ "admin.users.profile": () => Effect.succeed("user profile") }),
	workspaces: Workspaces.contract.application.toLayer({ "admin.workspaces.read": ({ id }) => Effect.succeed(`Workspace ${id}`) }),
});
