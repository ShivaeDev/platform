import { Schema } from "effect";
import { hasPermission, Permission } from "@shivaedev/access/permission.ts";

export const PermissionSession = Schema.Struct({
	user: Schema.Struct({ permissions: Schema.optionalKey(Schema.Array(Permission)) }),
});
export type PermissionSession = typeof PermissionSession.Type;

export function can(session: PermissionSession | null | undefined, permission: Permission): boolean {
	return hasPermission(session?.user.permissions, permission);
}
