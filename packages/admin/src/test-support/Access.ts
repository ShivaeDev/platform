import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { ChangeUserRoles } from "@shivaedev/platform/rpc/userRoles.ts";
import { OpenAdmin } from "#permissions.ts";

export const Access = roleSet(
	role("user", []),
	role("owner", [ChangeUserRoles]),
	role("admin", [OpenAdmin]),
	role("admin,owner", [OpenAdmin, ChangeUserRoles]),
);
