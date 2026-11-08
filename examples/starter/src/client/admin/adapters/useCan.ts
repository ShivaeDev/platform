import { useContext } from "react";
import { hasPermission, type Permission } from "@shivaedev/access/permission.ts";
import { PermissionContext } from "#client/adapters/PermissionContext.ts";

export function useCan(): (permission: Permission) => boolean {
	const context = useContext(PermissionContext);
	return (permission) => hasPermission(context?.session?.user.permissions, permission);
}
