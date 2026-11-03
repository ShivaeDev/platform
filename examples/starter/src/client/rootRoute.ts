import { createRootRouteWithContext } from "@tanstack/react-router";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { adminPermissionGuard } from "@shivaedev/admin/client/adapters/adminPermissionGuard.ts";
import { permissionGuard } from "@shivaedev/react/adapters/permissionGuard.ts";
import type { AdminNavigation } from "./AdminNavigation.ts";
import type { AppSession, AuthActions } from "./auth.ts";
import type { ClientModule } from "./Module.ts";

export function rootRoute() {
	return createRootRouteWithContext<{
		readonly modules: readonly ClientModule[];
		readonly registry: AtomRegistry.AtomRegistry;
		readonly auth: AuthActions;
		readonly navigate: (path: string) => void;
		readonly adminPages: readonly AdminNavigation[];
		readonly session: () => AppSession | null | undefined;
	}>()<unknown>({
		beforeLoad: (route) =>
			adminPermissionGuard(route.context.adminPages, permissionGuard({ session: route.context.session, signIn: "/sign-in" }))(route),
	});
}
