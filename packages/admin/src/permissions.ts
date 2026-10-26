import { permission } from "@shivaedev/access/permission.ts";
import { permissionMiddleware } from "@shivaedev/identity/permission.ts";

export const OpenAdmin = permission("admin.open");
export class AdminPermission extends permissionMiddleware<AdminPermission>()("@shivaedev/admin/Permission", OpenAdmin) {}
