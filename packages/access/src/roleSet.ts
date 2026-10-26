import { Effect, Schema } from "effect";
import { Forbidden, Unauthorized } from "@shivaedev/contract/errors/taxonomy.ts";
import type { OwnPermission, Permission } from "#permission.ts";
import type { Role as RoleDefinition } from "#role.ts";

export interface User<TName extends string> {
	readonly id: string;
	readonly role: TName;
}

export function roleSet<const TName extends string>(...roles: readonly [RoleDefinition<TName>, ...RoleDefinition<TName>[]]) {
	const Role = Schema.Literals(roles.map((role) => role.name));
	function hasPermission(name: TName, permission: Permission): boolean {
		return roles.some(
			(role) =>
				role.name === name && role.permissions.some((granted) => granted.name === permission.name && granted.strength === permission.strength),
		);
	}
	function canAccess(user: User<TName> | null | undefined, permission: OwnPermission, ownerId: string): boolean {
		return (
			user !== null
			&& user !== undefined
			&& (hasPermission(user.role, permission.any) || (user.id === ownerId && hasPermission(user.role, permission)))
		);
	}
	function requirePermission(user: User<TName> | null | undefined, permission: Permission): Effect.Effect<void, Forbidden | Unauthorized> {
		if (user === null || user === undefined) {
			return Effect.fail(new Unauthorized({ message: "Sign in to continue" }));
		}
		return hasPermission(user.role, permission)
			? Effect.void
			: Effect.fail(
					new Forbidden({
						message: `Permission required: ${permission.name} (${permission.strength})`,
					}),
				);
	}
	function requireAccess(
		user: User<TName> | null | undefined,
		permission: OwnPermission,
		ownerId: string,
	): Effect.Effect<void, Forbidden | Unauthorized> {
		if (user === null || user === undefined) {
			return Effect.fail(new Unauthorized({ message: "Sign in to continue" }));
		}
		return canAccess(user, permission, ownerId) ? Effect.void : Effect.fail(new Forbidden({ message: `Access denied: ${permission.name}` }));
	}
	function resolve(stored: unknown) {
		return Effect.map(Schema.decodeUnknownEffect(Role)(stored), (roleName) => ({
			permissions: (roles.find((candidate) => candidate.name === roleName)?.permissions ?? []).map(({ name, strength }) => ({ name, strength })),
			role: roleName,
		}));
	}
	return {
		canAccess,
		hasPermission,
		Role,
		requireAccess,
		requirePermission,
		resolve,
	};
}

export type RoleSet = Pick<ReturnType<typeof roleSet>, "resolve">;
