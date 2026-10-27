import { redirect } from "@tanstack/react-router";
import type { Permission } from "@shivaedev/access/permission.ts";
import { Forbidden } from "@shivaedev/errors/taxonomy.ts";
import { can, type PermissionSession } from "./permissions.ts";

declare module "@tanstack/react-router" {
	interface StaticDataRouteOption {
		readonly permission?: Permission;
	}
}

export interface PermissionGuardOptions {
	readonly session: () => PermissionSession | null | undefined;
	readonly signIn: string;
}

export function permissionGuard({ session, signIn }: PermissionGuardOptions) {
	return ({
		matches,
		location,
	}: {
		readonly location: { readonly href: string };
		readonly matches: readonly { readonly staticData: { readonly permission?: Permission } }[];
	}): void => {
		const required = matches.flatMap((match) => (match.staticData.permission === undefined ? [] : [match.staticData.permission]));
		if (required.length === 0) {
			return;
		}
		const current = session();
		if (current === null || current === undefined) {
			throw redirect({ search: { returnTo: location.href }, to: signIn });
		}
		for (const permission of required) {
			if (!can(current, permission)) {
				throw new Forbidden({ message: `Permission required: ${permission.name} (${permission.strength})` });
			}
		}
	};
}
