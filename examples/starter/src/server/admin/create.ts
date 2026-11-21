import { provisionAdmin } from "@shivaedev/identity/server/better-auth/provisionAdmin.ts";
import { Owner } from "#roles/Owner.ts";
import { AppAuth } from "#server/AppAuth.ts";

export const createAdmin = provisionAdmin(AppAuth, Owner.name);
