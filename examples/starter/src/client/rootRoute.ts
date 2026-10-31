import { createRootRouteWithContext } from "@tanstack/react-router";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { PermissionSession } from "@shivaedev/react/permissions.ts";
import type { AdminNavigation } from "#client/admin/Shell.tsx";
import type { AuthActions } from "./auth.ts";

export function rootRoute() {
	return createRootRouteWithContext<{
		readonly registry: AtomRegistry.AtomRegistry;
		readonly auth: AuthActions;
		readonly navigate: (path: string) => void;
		readonly adminPages: readonly AdminNavigation[];
		readonly session: () => PermissionSession | null | undefined;
	}>()<unknown>();
}
