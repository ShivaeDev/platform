import { hasPermission, type Permission } from "@shivaedev/access/permission.ts";
import type { PermissionSession } from "@shivaedev/identity/PermissionSession.ts";

export function can(session: PermissionSession | null | undefined, permission: Permission): boolean {
	return hasPermission(session?.user.permissions, permission);
}
