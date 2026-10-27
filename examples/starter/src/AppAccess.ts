import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { OpenAdmin } from "@shivaedev/admin/permissions.ts";
import { ChangeUserRoles } from "@shivaedev/admin/users/roles.ts";

export const AppAccess = roleSet(
	role("user", []),
	role("admin", [OpenAdmin]),
	role("owner", [ChangeUserRoles]),
	role("user,admin", [OpenAdmin]),
	role("user,owner", [ChangeUserRoles]),
	role("admin,owner", [OpenAdmin, ChangeUserRoles]),
	role("user,admin,owner", [OpenAdmin, ChangeUserRoles]),
);
