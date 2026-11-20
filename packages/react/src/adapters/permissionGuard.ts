import { notFound } from "@tanstack/react-router";
import type { Permission } from "@shivaedev/access/permission.ts";
import { forbidden } from "@shivaedev/access/refusal.ts";
import type { PermissionSession } from "@shivaedev/identity/PermissionSession.ts";
import type { QueryRouteRedirect } from "#adapters/queryRouteFailure.ts";
import { can } from "#can.ts";
import type { SignInLocation } from "#signInSearch.ts";

declare module "@tanstack/react-router" {
	interface StaticDataRouteOption {
		readonly permission?: Permission;
		readonly signedIn?: boolean;
	}
}

export interface PermissionGuardOptions {
	readonly hidden?: boolean;
	readonly session: () => PermissionSession | null | undefined;
	readonly signedOut: (location: SignInLocation) => QueryRouteRedirect;
}

export interface PermissionGuardContext {
	readonly location: SignInLocation;
	readonly matches: readonly { readonly staticData: { readonly permission?: Permission; readonly signedIn?: boolean } }[];
}

export function permissionGuard({ session, signedOut, hidden = false }: PermissionGuardOptions): (context: PermissionGuardContext) => void {
	return ({ matches, location }) => {
		const required = matches.flatMap((match) => (match.staticData.permission === undefined ? [] : [match.staticData.permission]));
		if (required.length === 0 && !matches.some((match) => match.staticData.signedIn === true)) {
			return;
		}
		const current = session();
		if (current === null || current === undefined) {
			throw signedOut(location);
		}
		for (const permission of required) {
			if (!can(current, permission)) {
				throw hidden ? notFound() : forbidden(permission);
			}
		}
	};
}
