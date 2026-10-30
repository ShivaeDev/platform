import { hasPermission, type Permission } from "@shivaedev/access/permission.ts";

export interface PermissionSession {
	readonly user: {
		readonly permissions?: readonly Permission[];
	};
}

export function can(session: PermissionSession | null | undefined, permission: Permission): boolean {
	return hasPermission(session?.user.permissions, permission);
}
