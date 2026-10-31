import { migrateBetterAuth } from "@shivaedev/identity/server/better-auth/migrate.ts";
import { User } from "#roles/User.ts";
import { authOptions } from "#server/authOptions.ts";

export default migrateBetterAuth(authOptions(), { defaultRole: User.name });
