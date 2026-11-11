import { Schema } from "effect";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { hasPermission } from "@shivaedev/identity/permission.ts";
import { AssignRoles } from "@shivaedev/identity/roles.ts";
import { UserDirectory } from "@shivaedev/identity/server/UserDirectory.ts";
import { UserListInput, userKeys } from "@shivaedev/identity/users.ts";
import { adminUsersWire } from "#generated/Users.ts";
import { UsersPermission } from "#permissions.ts";
import { changeUserRole, listUsers } from "#server/users.ts";
import type { UsersList } from "#users/List.ts";

const ListUsers = query("list", {
	payload: UserListInput.fields,
	reads: () => [userKeys.list],
	*run(input) {
		const user = yield* SessionUser;
		const list: UsersList = { ...(yield* listUsers(input)), canChangeRoles: hasPermission(user, AssignRoles) };
		return list;
	},
});

const ChangeRole = command("changeRole", {
	invalidates: () => [userKeys.list],
	payload: { role: Schema.String, userId: Schema.String },
	*run(input) {
		yield* changeUserRole(input);
	},
});

export const Users = defineModule({
	middleware: UsersPermission,
	name: "admin.users",
	operations: [ListUsers, ChangeRole],
	requires: [UserDirectory],
	wire: adminUsersWire,
});
