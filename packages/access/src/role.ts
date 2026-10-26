import type { Permission } from "#permission.ts";

export interface Role<TName extends string = string> {
	readonly name: TName;
	readonly permissions: readonly Permission[];
}

export function role<const TName extends string>(name: TName, permissions: readonly Permission[]): Role<TName> {
	return { name, permissions };
}
