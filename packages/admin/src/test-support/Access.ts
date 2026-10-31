import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { AssignRoles } from "@shivaedev/access/roles.ts";
import { ReadJobs, ReadUsers, RetryJobs } from "#permissions.ts";

export const Access = roleSet(
	role("user", []),
	role("assigner", [AssignRoles]),
	role("admin", [ReadUsers, ReadJobs, RetryJobs]),
	role("owner", [ReadUsers, ReadJobs, RetryJobs, AssignRoles]),
	role("delegate", [ReadUsers, AssignRoles]),
	role("auditor", [ReadUsers]),
	role("operator", [ReadJobs]),
);
