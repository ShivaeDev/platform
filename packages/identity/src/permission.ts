import { RpcMiddleware } from "effect/rpc";
import { hasPermission as evaluateGrant, type Permission } from "@shivaedev/access/permission.ts";
import type { Identity, SessionUser, SessionUserValue } from "./identity.ts";
import { IdentityFailures } from "./middleware.ts";

export function permissionMiddleware<TSelf>() {
	return <const TName extends string>(name: TName, permission: Permission) =>
		Object.assign(RpcMiddleware.Service<TSelf, { provides: Identity | SessionUser }>()(name, { error: IdentityFailures }), { permission });
}

export function hasPermission(user: Pick<SessionUserValue, "id" | "permissions">, permission: Permission): boolean {
	return evaluateGrant(user.permissions, permission);
}
