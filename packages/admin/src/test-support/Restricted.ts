import { Effect } from "effect";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { adminRestrictedWire } from "#generated/test-support/Restricted.ts";
import { UsersPermission } from "#permissions.ts";

const Profile = query("profile", {
	readPolicy: () => Effect.succeed(false),
	reads: () => [],
	*run() {
		const { email } = yield* SessionUser;
		return email;
	},
});

// Written as an application writes an admin page's operations, so the registry serves a defined module beside today's pages.
export const Restricted = defineModule({
	middleware: UsersPermission,
	name: "admin.restricted",
	operations: [Profile],
	requires: [],
	wire: adminRestrictedWire,
});
