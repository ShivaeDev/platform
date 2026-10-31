import { createRootRouteWithContext } from "@tanstack/react-router";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { permissionGuard } from "@shivaedev/react/permissionGuard.ts";
import type { AdminNavigation } from "#client/admin/Shell.tsx";
import type { AppSession, AuthActions } from "./auth.ts";

export function rootRoute() {
	return createRootRouteWithContext<{
		readonly registry: AtomRegistry.AtomRegistry;
		readonly auth: AuthActions;
		readonly navigate: (path: string) => void;
		readonly adminPages: readonly AdminNavigation[];
		readonly session: () => AppSession | null | undefined;
	}>()<unknown>({
		beforeLoad: (route): void => permissionGuard({ session: route.context.session, signIn: "/sign-in" })(route),
	});
}
