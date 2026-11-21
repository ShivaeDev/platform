import { WorkspaceCollection } from "#generated/test-support/WorkspaceCollection.ts";
import { adminPage } from "#page.ts";
import { UsersPermission } from "#permissions.ts";

export function collectionPage() {
	return adminPage({
		contract: WorkspaceCollection,
		id: "workspaces",
		permission: UsersPermission,
		route: { path: "/admin/workspaces", title: "Workspaces" },
	});
}
