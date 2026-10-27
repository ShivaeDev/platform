import { roleSet } from "@shivaedev/access/roleSet.ts";
import { Admin } from "#roles/Admin.ts";
import { Owner } from "#roles/Owner.ts";
import { User } from "#roles/User.ts";

export const AppAccess = roleSet(User, Admin, Owner);
