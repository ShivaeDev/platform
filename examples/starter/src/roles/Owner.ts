import { role } from "@shivaedev/access/role.ts";
import { AssignRoles } from "@shivaedev/access/roles.ts";
import { ReadJobs, ReadUsers } from "@shivaedev/admin/permissions.ts";
import { ReadStatistics } from "#appPermissions.ts";

export const Owner = role("owner", [ReadUsers, ReadJobs, ReadStatistics, AssignRoles]);
