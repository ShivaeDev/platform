import { role } from "@shivaedev/access/role.ts";
import { ReadJobs, ReadUsers } from "@shivaedev/admin/permissions.ts";
import { ManageSessions } from "@shivaedev/identity/sessionPermissions.ts";
import { ReadStatistics } from "#admin/ReadStatistics.ts";

export const Admin = role("admin", [ReadUsers, ReadJobs, ReadStatistics, ManageSessions]);
