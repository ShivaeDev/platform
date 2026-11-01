import { notFound, redirect } from "@tanstack/react-router";
import type { Permission } from "@shivaedev/access/permission.ts";
import { forbidden } from "@shivaedev/access/refusal.ts";
import { can, type PermissionSession } from "./permissions.ts";
import { type SignInLocation, signInSearch } from "./signInSearch.ts";

declare module "@tanstack/react-router" {
	interface StaticDataRouteOption {
		readonly permission?: Permission;
		readonly signedIn?: boolean;
	}
}

export interface PermissionGuardOptions {
	readonly hidden?: boolean;
	readonly session: () => PermissionSession | null | undefined;
	readonly signIn: string;
}

export interface PermissionGuardContext {
	readonly location: SignInLocation;
	readonly matches: readonly { readonly staticData: { readonly permission?: Permission; readonly signedIn?: boolean } }[];
}

export function permissionGuard({ session, signIn, hidden = false }: PermissionGuardOptions): (context: PermissionGuardContext) => void {
	return ({ matches, location }) => {
		const required = matches.flatMap((match) => (match.staticData.permission === undefined ? [] : [match.staticData.permission]));
		if (required.length === 0 && !matches.some((match) => match.staticData.signedIn === true)) {
			return;
		}
		const current = session();
		if (current === null || current === undefined) {
			throw redirect({ search: signInSearch(location), to: signIn });
		}
		for (const permission of required) {
			if (!can(current, permission)) {
				throw hidden ? notFound() : forbidden(permission);
			}
		}
	};
}
