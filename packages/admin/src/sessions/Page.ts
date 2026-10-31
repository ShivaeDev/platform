import { SessionsPermission } from "@shivaedev/identity/sessionPermissions.ts";
import { Sessions } from "@shivaedev/identity/sessions.ts";
import { adminPage } from "#page.ts";

export const SessionsPage = adminPage({
	contract: Sessions,
	id: "sessions",
	permission: SessionsPermission,
	route: { path: "/admin/sessions", title: "Sessions" },
});
