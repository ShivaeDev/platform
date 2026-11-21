import { createRootRouteWithContext } from "@tanstack/react-router";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { Permission } from "@shivaedev/access/permission.ts";
import { type PermissionGuardOptions, permissionGuard } from "#adapters/permissionGuard.ts";
import type { AdminNavigation, ModuleParts, RegisteredAuth, RegisteredSession } from "#client/module.ts";

export interface SessionRouteContext {
	readonly adminPages: readonly AdminNavigation[];
	readonly auth: RegisteredAuth;
	readonly modules: readonly ModuleParts[];
	readonly navigate: (path: string) => void;
	// Naming the guard's type here carries its staticData augmentation into every app that reads the root route's type.
	readonly redirects: { readonly signedOut: PermissionGuardOptions["signedOut"] };
	readonly registry: AtomRegistry.AtomRegistry;
	readonly session: () => RegisteredSession | null | undefined;
}

function template(path: string): string {
	return path.replace(/\/\$[^/]+/gu, "/$").replace(/\/$/u, "");
}

// The router has already matched the location, so an admin page's permission applies to the matched route with its path or detail path, whatever its parameters are named.
function adminPagePermissions(pages: readonly AdminNavigation[], matches: readonly { readonly fullPath: string }[]) {
	const permissions = new Map<string, Permission>(
		pages.flatMap(({ route }) =>
			[route.path, ...(route.detail === undefined ? [] : [route.detail])].map((path) => [template(path), route.permission]),
		),
	);
	return matches.flatMap((match) => {
		const permission = permissions.get(template(match.fullPath));
		return permission === undefined ? [] : [{ staticData: { permission } }];
	});
}

export function sessionRoot() {
	return createRootRouteWithContext<SessionRouteContext>()<unknown>({
		beforeLoad: ({ context, location, matches }) =>
			permissionGuard({ session: context.session, signedOut: context.redirects.signedOut })({
				location,
				matches: [...matches, ...adminPagePermissions(context.adminPages, matches)],
			}),
	});
}
