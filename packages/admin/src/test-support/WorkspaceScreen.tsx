import type { Permission } from "@shivaedev/access/permission.ts";
import { permissionGuard } from "@shivaedev/react/adapters/permissionGuard.ts";
import { adminPermissionGuard } from "#client/adapters/adminPermissionGuard.ts";
import { workspaceRegistration } from "./workspaces.ts";

export function WorkspaceScreen({ path, permissions }: { readonly path: string; readonly permissions: readonly Permission[] }) {
	adminPermissionGuard(
		workspaceRegistration.pages,
		permissionGuard({ session: () => ({ user: { permissions } }), signIn: "/sign-in" }),
	)({
		location: { href: path, pathname: path },
		matches: [],
	});
	return <main>Workspaces: {path}</main>;
}
