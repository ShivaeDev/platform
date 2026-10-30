import { Effect, Schema } from "effect";
import type { Forbidden, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { hasPermission as evaluateGrant, type OwnPermission, Permission } from "#permission.ts";
import { forbidden, unauthorized } from "#refusal.ts";
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
		return evaluateGrant(grantsOf(name), permission);
	}
	function canAccess(user: User<TName> | null | undefined, permission: OwnPermission, ownerId: string): boolean {
		return (
			user !== null
			&& user !== undefined
			&& (hasPermission(user.role, permission.any) || (user.id === ownerId && hasPermission(user.role, permission)))
		);
	}
	function requireAccess(
		user: User<TName> | null | undefined,
		permission: OwnPermission,
		ownerId: string,
	): Effect.Effect<void, Forbidden | Unauthorized> {
		if (user === null || user === undefined) {
			return Effect.fail(unauthorized());
		}
		return canAccess(user, permission, ownerId) ? Effect.void : Effect.fail(forbidden(permission));
	}
	function resolve(stored: unknown) {
		return Effect.gen(function* () {
			const role = yield* Schema.decodeUnknownEffect(Role)(stored);
			const permissions = yield* Schema.decodeUnknownEffect(Schema.Array(Permission))(grantsOf(role));
			return { permissions, role };
		});
	}
	return {
		canAccess,
		hasPermission,
		Role,
		requireAccess,
		resolve,
	};
}

export type RoleSet = Pick<AccessPolicy<string>, "resolve">;
