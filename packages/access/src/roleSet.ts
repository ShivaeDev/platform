import { Effect, Schema } from "effect";
import { Forbidden, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import type { OwnPermission, Permission } from "#permission.ts";
import type { Role as RoleDefinition } from "#role.ts";

export interface User<TName extends string> {
	readonly id: string;
	readonly role: TName;
}

type RoleList = readonly [RoleDefinition, ...RoleDefinition[]];

type RepeatedName<TRoles extends readonly RoleDefinition[], TSeen extends string = never> = TRoles extends readonly [
	infer THead extends RoleDefinition,
	...infer TTail extends readonly RoleDefinition[],
]
	? (string extends THead["name"] ? never : THead["name"] extends TSeen ? THead["name"] : never) | RepeatedName<TTail, TSeen | THead["name"]>
	: never;

type DistinctNames<TRoles extends RoleList> = [RepeatedName<TRoles>] extends [never]
	? unknown
	: { readonly "each role name is declared once": RepeatedName<TRoles> };

export type AccessPolicy<TName extends string> = ReturnType<typeof accessPolicy<TName>>;

export function roleSet<const TRoles extends RoleList>(...roles: TRoles & DistinctNames<TRoles>): AccessPolicy<TRoles[number]["name"]> {
	return accessPolicy<TRoles[number]["name"]>(roles);
}

function accessPolicy<TName extends string>(roles: readonly RoleDefinition<TName>[]) {
	const Role = Schema.Literals(roles.map((role) => role.name));
	const grantsByName = new Map<string, readonly Permission[]>();
	for (const role of roles) {
		if (!grantsByName.has(role.name)) {
			grantsByName.set(role.name, role.permissions);
		}
	}
	function grantsOf(name: TName): readonly Permission[] {
		return grantsByName.get(name) ?? [];
	}
	function hasPermission(name: TName, permission: Permission): boolean {
		return grantsOf(name).some((granted) => granted.name === permission.name && granted.strength === permission.strength);
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
			permissions: grantsOf(roleName).map(({ name, strength }) => ({ name, strength })),
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

export type RoleSet = Pick<AccessPolicy<string>, "resolve">;
