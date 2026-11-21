import { createRootRouteWithContext } from "@tanstack/react-router";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { adminPermissionGuard } from "@shivaedev/admin/client/adminPermissionGuard.ts";
import { permissionGuard } from "@shivaedev/react/adapters/permissionGuard.ts";
import type { AdminNavigation, ModuleParts } from "@shivaedev/react/client/module.ts";
import type { QueryRouteRedirects } from "@shivaedev/react/queryRouteFailure.ts";
import type { AppSession, AuthActions } from "#client/adapters/auth.ts";

declare module "@shivaedev/react/client/module.ts" {
	interface Register {
		readonly root: ReturnType<typeof rootRoute>;
	}
}

export function rootRoute() {
	return createRootRouteWithContext<{
		readonly modules: readonly ModuleParts[];
		readonly registry: AtomRegistry.AtomRegistry;
		readonly auth: AuthActions;
		readonly navigate: (path: string) => void;
		readonly redirects: Required<Pick<QueryRouteRedirects, "signedOut">>;
		readonly adminPages: readonly AdminNavigation[];
		readonly session: () => AppSession | null | undefined;
	}>()<unknown>({
		beforeLoad: (route) =>
			adminPermissionGuard(
				route.context.adminPages,
				permissionGuard({ session: route.context.session, signedOut: route.context.redirects.signedOut }),
			)(route),
	});
}
