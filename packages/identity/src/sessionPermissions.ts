import { permission } from "@shivaedev/access/permission.ts";
import { permissionMiddleware } from "#permission.ts";

export const ManageSessions = permission("sessions.manage");
export class SessionsPermission extends permissionMiddleware<SessionsPermission>()("@shivaedev/identity/SessionsPermission", ManageSessions) {}
