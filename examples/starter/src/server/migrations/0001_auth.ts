import { admin } from "better-auth/plugins";
import { migrateBetterAuth } from "@shivaedev/identity/server/better-auth/migrate.ts";

export default migrateBetterAuth({ emailAndPassword: { enabled: true }, plugins: [admin()] });
