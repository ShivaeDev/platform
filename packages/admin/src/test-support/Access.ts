import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { AssignRoles, ReadJobs, ReadUsers } from "#permissions.ts";

export const Access = roleSet(
	role("user", []),
	role("assigner", [AssignRoles]),
	role("admin", [ReadUsers, ReadJobs]),
	role("owner", [ReadUsers, ReadJobs, AssignRoles]),
	role("delegate", [ReadUsers, AssignRoles]),
	role("auditor", [ReadUsers]),
	role("operator", [ReadJobs]),
);
