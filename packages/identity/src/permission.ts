import { Effect } from "effect";
import { RpcMiddleware } from "effect/rpc";
import type { Permission } from "@shivaedev/access/permission.ts";
import { Forbidden } from "@shivaedev/errors/taxonomy.ts";
import { type Identity, SessionUser, type SessionUserValue } from "./identity.ts";
import { IdentityFailures } from "./middleware.ts";

export function permissionMiddleware<TSelf>() {
	return <const TName extends string>(name: TName, permission: Permission) =>
		Object.assign(RpcMiddleware.Service<TSelf, { provides: Identity | SessionUser }>()(name, { error: IdentityFailures }), { permission });
}

export function hasPermission(user: Pick<SessionUserValue, "id" | "permissions">, permission: Permission): boolean {
	return user.permissions?.some((grant) => grant.name === permission.name && grant.strength === permission.strength) ?? false;
}

export function requirePermission(permission: Permission) {
	return Effect.flatMap(SessionUser, (user) =>
		hasPermission(user, permission)
			? Effect.succeed(user)
			: Effect.fail(new Forbidden({ message: `Permission required: ${permission.name} (${permission.strength})` })),
	);
}
