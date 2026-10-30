import { Effect } from "effect";
import type { Forbidden } from "@shivaedev/errors/taxonomy.ts";
import { hasPermission, type Permission } from "./permission.ts";
import { forbidden } from "./refusal.ts";

export interface PermissionUser {
	readonly permissions?: readonly Permission[];
}

export function requirePermission(user: PermissionUser, permission: Permission): Effect.Effect<void, Forbidden> {
	return hasPermission(user.permissions, permission) ? Effect.void : Effect.fail(forbidden(permission));
}
