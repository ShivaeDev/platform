import { permission } from "@shivaedev/access/permission.ts";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { permissionMiddleware } from "#rpc/permission.ts";

export const UseTools = permission("tools.use");
export const ManageTools = permission("tools.manage");
export class ToolsPermission extends permissionMiddleware<ToolsPermission>()("test/ToolsPermission", UseTools) {}
export class ManagementPermission extends permissionMiddleware<ManagementPermission>()("test/ManagementPermission", ManageTools) {}
export const TestRoles = roleSet(
	role("user", []),
	role("operator", [UseTools]),
	role("auditor", [UseTools.any]),
	role("admin", [UseTools]),
	role("owner", [ManageTools]),
	role("admin,owner", [UseTools, ManageTools]),
);
