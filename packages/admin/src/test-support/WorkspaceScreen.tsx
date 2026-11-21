import type { Permission } from "@shivaedev/access/permission.ts";
import { permissionGuard } from "@shivaedev/react/adapters/permissionGuard.ts";
import { signInRedirect } from "@shivaedev/react/signInRedirect.ts";
import { adminPermissionGuard } from "#client/adminPermissionGuard.ts";
import { WorkspacePages } from "#test/workspaces.ts";

export function WorkspaceScreen({ path, permissions }: { readonly path: string; readonly permissions: readonly Permission[] }) {
	adminPermissionGuard(
		WorkspacePages.pages,
		permissionGuard({ session: () => ({ user: { permissions } }), signedOut: signInRedirect("/sign-in") }),
	)({
		location: { href: path, pathname: path },
		matches: [],
	});
	return <main>Workspaces: {path}</main>;
}
