import { permission } from "@shivaedev/access/permission.ts";
import { permissionMiddleware } from "@shivaedev/identity/permission.ts";

export const ReadUsers = permission("users.read");
export const AssignRoles = permission("roles.assign");
export const ReadJobs = permission("jobs.read");
export class UsersPermission extends permissionMiddleware<UsersPermission>()("@shivaedev/admin/UsersPermission", ReadUsers) {}
export class JobsPermission extends permissionMiddleware<JobsPermission>()("@shivaedev/admin/JobsPermission", ReadJobs) {}
