import { permission } from "#permission.ts";
import { role } from "#role.ts";
import { roleSet } from "#roleSet.ts";

export const ReadUsers = permission("users.read");
export const AssignRoles = permission("roles.assign");
export const ReadJobs = permission("jobs.read");
export const ReadJobDetails = permission("jobs.read.details");
export const ReadAllUsers = ReadUsers.any;

export const Reader = role("reader", [ReadUsers, ReadJobs]);
export const Manager = role("manager", [ReadAllUsers, AssignRoles]);
export const Guest = role("guest", []);
export const Access = roleSet(Reader, Manager, Guest);
