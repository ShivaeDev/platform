import { permission } from "@shivaedev/access/permission.ts";
import { permissionMiddleware } from "@shivaedev/platform/rpc/permission.ts";

export const OpenAdmin = permission("admin.open");
export class AdminPermission extends permissionMiddleware<AdminPermission>()("@shivaedev/admin/Permission", OpenAdmin) {}
