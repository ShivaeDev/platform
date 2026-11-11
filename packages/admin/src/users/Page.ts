import { Users } from "#generated/Users.ts";
import { adminPage } from "#page.ts";
import { UsersPermission } from "#permissions.ts";

export const UsersPage = adminPage({
	contract: Users,
	id: "users",
	permission: UsersPermission,
	route: { path: "/admin/users", title: "Users" },
});
