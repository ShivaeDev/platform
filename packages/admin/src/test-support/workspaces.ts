import { permission } from "@shivaedev/access/permission.ts";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { permissionMiddleware } from "@shivaedev/identity/permission.ts";
import { ExportReads as ExportReadsClient } from "#generated/test-support/ExportReads.ts";
import { WorkspaceAdmin as WorkspaceAdminClient } from "#generated/test-support/WorkspaceAdmin.ts";
import { adminPage } from "#page.ts";
import { ReadUsers, UsersPermission } from "#permissions.ts";
import { adminRegistry } from "#registry.ts";
import { Users } from "#test/pages.ts";

export const ReadWorkspaces = permission("workspaces.read");
class WorkspacesPermission extends permissionMiddleware<WorkspacesPermission>()("test/WorkspacesPermission", ReadWorkspaces) {}
export const WorkspaceAccess = roleSet(role("workspace-reader", [ReadWorkspaces]), role("auditor", [ReadUsers]), role("viewer", []));
export type WorkspaceRole = typeof WorkspaceAccess.Role.Type;
export const Workspaces = adminPage({
	contract: WorkspaceAdminClient,
	id: "workspaces",
	permission: WorkspacesPermission,
	route: { detail: "/admin/workspaces/$id/", path: "/admin/workspaces", title: "Workspaces" },
});
const WorkspaceExports = adminPage({
	contract: ExportReadsClient,
	id: "exports",
	permission: UsersPermission,
	route: { path: "/admin/exports", title: "Exports" },
});
// Browser-safe: the pages and their contracts, without the modules that serve them.
export const WorkspacePages = adminRegistry(Workspaces, Users, WorkspaceExports);
