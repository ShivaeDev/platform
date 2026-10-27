import { role } from "@shivaedev/access/role.ts";
import { ReadJobs, ReadUsers } from "@shivaedev/admin/permissions.ts";
import { ReadStatistics } from "#appPermissions.ts";

export const Admin = role("admin", [ReadUsers, ReadJobs, ReadStatistics]);
