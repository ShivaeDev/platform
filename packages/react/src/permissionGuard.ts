import { redirect } from "@tanstack/react-router";
import type { Permission } from "@shivaedev/access/permission.ts";
import { Forbidden } from "@shivaedev/errors/taxonomy.ts";
import { can, type PermissionSession } from "./permissions.ts";
import { type SignInLocation, signInSearch } from "./signInSearch.ts";

declare module "@tanstack/react-router" {
	interface StaticDataRouteOption {
		readonly permission?: Permission;
	}
}

export interface PermissionGuardOptions {
	readonly session: () => PermissionSession | null | undefined;
	readonly signIn: string;
}

export interface PermissionGuardContext {
	readonly location: SignInLocation;
	readonly matches: readonly { readonly staticData: { readonly permission?: Permission } }[];
}

export function permissionGuard({ session, signIn }: PermissionGuardOptions): (context: PermissionGuardContext) => void {
	return ({ matches, location }) => {
		const required = matches.flatMap((match) => (match.staticData.permission === undefined ? [] : [match.staticData.permission]));
		if (required.length === 0) {
			return;
		}
		const current = session();
		if (current === null || current === undefined) {
			throw redirect({ search: signInSearch(location), to: signIn });
		}
		for (const permission of required) {
			if (!can(current, permission)) {
				throw new Forbidden({ message: `Permission required: ${permission.name} (${permission.strength})` });
			}
		}
	};
}
