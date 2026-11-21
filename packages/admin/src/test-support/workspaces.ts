import { permission } from "@shivaedev/access/permission.ts";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { permissionMiddleware } from "@shivaedev/identity/permission.ts";
import { ExportReads as ExportReadsClient } from "#generated/test-support/ExportReads.ts";
import { WorkspaceReads as WorkspaceReadsClient } from "#generated/test-support/WorkspaceReads.ts";
import { adminPage } from "#page.ts";
import { ReadUsers, UsersPermission } from "#permissions.ts";
import { adminRegistry } from "#registry.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import { ExportReads } from "#test/ExportReads.ts";
import { FakeUsers } from "#test/FakeUsers.ts";
import { Users } from "#test/pages.ts";
import { WorkspaceReads } from "#test/WorkspaceReads.ts";

export const ReadWorkspaces = permission("workspaces.read");
class WorkspacesPermission extends permissionMiddleware<WorkspacesPermission>()("test/WorkspacesPermission", ReadWorkspaces) {}
export const WorkspaceAccess = roleSet(role("workspace-reader", [ReadWorkspaces]), role("auditor", [ReadUsers]), role("viewer", []));
export type WorkspaceRole = typeof WorkspaceAccess.Role.Type;
export const Workspaces = adminPage({
	contract: WorkspaceReadsClient,
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
export const workspaceRegistration = registerAdmin(adminRegistry(Workspaces, Users, WorkspaceExports), {
	exports: ExportReads,
	users: FakeUsers,
	workspaces: WorkspaceReads,
});
