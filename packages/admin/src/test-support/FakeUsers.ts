import { Effect } from "effect";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { adminUsersWire } from "#generated/test-support/FakeUsers.ts";
import { UsersPermission } from "#permissions.ts";

const Profile = query("profile", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [],
	*run() {
		const { email } = yield* SessionUser;
		return email;
	},
});

export const FakeUsers = defineModule({
	middleware: UsersPermission,
	name: "admin.users",
	operations: [Profile],
	wire: adminUsersWire,
});
